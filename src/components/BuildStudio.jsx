import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageService } from "../features/conversation/services/MessageService";
import { supabase } from "../lib/supabase.js";
import {
  createProjectArchive,
  downloadProject,
  getDeployInstructions,
  getTotalProjectSize,
} from "../lib/projectArchive.js";
import { buildStudioPrompt, parseGeneratedFiles } from "../lib/studioProjects.js";

const PROJECT_TYPES = [
  { value: "website", label: "Website" },
  { value: "pwa", label: "Installable PWA" },
  { value: "game", label: "Web game" },
  { value: "android", label: "Native app (iOS + Android)" },
];

const OUTPUT_LIMIT = 350_000;

function createPreviewDocument(html) {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'; object-src \'none\'; navigate-to \'none\'">';
  const head = /<head(?:\s[^>]*)?>/i;

  if (head.test(html)) {
    return html.replace(head, (match) => `${match}${policy}`);
  }

  return `<!doctype html><html><head>${policy}</head><body>${html}</body></html>`;
}

export default function BuildStudio({ user }) {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [projectType, setProjectType] = useState("website");
  const [cameraOverlay, setCameraOverlay] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [project, setProject] = useState(null);
  const [activeFile, setActiveFile] = useState("index.html");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showDeploy, setShowDeploy] = useState(false);

  const activeSource = project?.files?.[activeFile] ?? "";
  const projectBusy = generating || saving;
  const previewHtml = useMemo(
    () => project?.files?.["index.html"]
      ? createPreviewDocument(project.files["index.html"])
      : "",
    [project],
  );

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    const loadProjects = async () => {
      setLoadingProjects(true);
      const { data, error: queryError } = await supabase
        .from("studio_projects")
        .select("id, name, kind, prompt, files, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (!active) return;
      if (queryError) {
        console.error("Could not load Build Studio projects:", queryError);
        setError("Could not load projects. Apply the Build Studio database migration and try again.");
      } else {
        setProjects(data ?? []);
      }
      setLoadingProjects(false);
    };

    loadProjects();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const generateProject = async (event) => {
    event.preventDefault();
    const brief = prompt.trim();
    if (!brief || projectBusy || !user?.id) return;
    if (isDirty && !window.confirm("Discard your unsaved project changes and create a new project?")) return;

    setGenerating(true);
    setError("");
    setNotice("");

    try {
      const chatId = await MessageService.createChat(user.id);
      await MessageService.updateChatTitle(chatId, `Build: ${brief}`);
      const response = await MessageService.requestTextResponse({
        message: buildStudioPrompt(projectType, brief, { cameraOverlay }),
        chatId,
        userId: user.id,
      });

      const generated = parseGeneratedFiles(response, projectType);
      const totalSize = Object.values(generated.files).reduce(
        (size, contents) => size + contents.length,
        0,
      );
      if (totalSize > OUTPUT_LIMIT) {
        throw new Error("The generated project is too large. Try a smaller brief.");
      }

      const { data, error: saveError } = await supabase
        .from("studio_projects")
        .insert({
          user_id: user.id,
          name: generated.name,
          kind: projectType,
          prompt: brief,
          files: generated.files,
        })
        .select("id, name, kind, prompt, files, created_at, updated_at")
        .single();

      if (saveError) throw saveError;

      setProject(data);
      setProjects((current) => [data, ...current]);
      setSelectedId(data.id);
      setActiveFile(data.files["index.html"] ? "index.html" : Object.keys(data.files)[0]);
      setIsDirty(false);
      setNotice("Project generated and saved.");
    } catch (generationError) {
      console.error("Build Studio generation failed:", generationError);
      setError(generationError instanceof Error
        ? generationError.message
        : "Project generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const selectProject = (selected) => {
    if (projectBusy) return;
    if (isDirty && !window.confirm("Discard your unsaved project changes?")) return;
    setProject(selected);
    setSelectedId(selected.id);
    setProjectType(selected.kind);
    setPrompt(selected.prompt);
    setActiveFile(selected.files?.["index.html"] ? "index.html" : Object.keys(selected.files ?? {})[0]);
    setIsDirty(false);
    setError("");
    setNotice("");
  };

  const startNewProject = () => {
    if (projectBusy) return;
    if (isDirty && !window.confirm("Discard your unsaved project changes?")) return;
    setProject(null);
    setSelectedId(null);
    setPrompt("");
    setActiveFile("index.html");
    setIsDirty(false);
    setError("");
    setNotice("");
  };

  const updateActiveFile = (contents) => {
    if (projectBusy) return;
    setProject((current) => ({
      ...current,
      files: { ...current.files, [activeFile]: contents },
    }));
    setIsDirty(true);
  };

  const saveProject = async () => {
    if (!project?.id || !isDirty || projectBusy) return;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { data, error: saveError } = await supabase
        .from("studio_projects")
        .update({ files: project.files, updated_at: new Date().toISOString() })
        .eq("id", project.id)
        .eq("user_id", user.id)
        .select("id, name, kind, prompt, files, created_at, updated_at")
        .single();

      if (saveError) throw saveError;

      setProject(data);
      setProjects((current) => current.map((item) => item.id === data.id ? data : item));
      setIsDirty(false);
      setNotice("Project changes saved.");
    } catch (saveError) {
      console.error("Could not save Build Studio project:", saveError);
      setError(`Could not save project: ${saveError instanceof Error ? saveError.message : "Unexpected error"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    if (projectBusy || !project || !window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;

    const { error: deleteError } = await supabase
      .from("studio_projects")
      .delete()
      .eq("id", project.id)
      .eq("user_id", user.id);

    if (deleteError) {
      setError(`Could not delete project: ${deleteError.message}`);
      return;
    }

    setProjects((current) => current.filter((item) => item.id !== project.id));
    setProject(null);
    setSelectedId(null);
    setIsDirty(false);
    setNotice("Project deleted.");
  };

  const downloadFile = () => {
    if (!activeFile || !activeSource) return;

    const url = URL.createObjectURL(
      new Blob([activeSource], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = activeFile.split("/").pop() || "project-file.txt";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadProject = () => {
    if (!project?.files) return;

    try {
      const archive = createProjectArchive(project.files);
      const url = URL.createObjectURL(
        new Blob([archive], { type: "application/zip" }),
      );
      const anchor = document.createElement("a");
      const safeName = project.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
      anchor.href = url;
      anchor.download = `${safeName || "project"}.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      console.error("Could not export Build Studio project:", downloadError);
      setError(downloadError instanceof Error
        ? `Could not export project: ${downloadError.message}`
        : "Could not export project. Please try again.");
    }
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-white">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
            Back to chat
          </Link>
          <div>
            <h1 className="font-semibold">Build Studio</h1>
            <p className="hidden text-xs text-zinc-500 sm:block">Turn a prompt into a working project</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startNewProject}
            disabled={projectBusy}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            New project
          </button>
          <span className="hidden max-w-48 truncate text-xs text-zinc-500 sm:block">{user?.email}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden overflow-y-auto border-r border-zinc-800 p-4 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Your projects</p>
          {loadingProjects ? (
            <p className="text-sm text-zinc-500">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm leading-6 text-zinc-500">Your generated projects will appear here.</p>
          ) : (
            <div className="space-y-1">
              {projects.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectProject(item)}
                  disabled={projectBusy}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${selectedId === item.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
                >
                  <span className="block truncate">{item.name}</span>
                  <span className="mt-1 block text-xs capitalize text-zinc-500">{item.kind}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <div className="lg:hidden">
            <label htmlFor="saved-projects" className="mb-1 block text-xs text-zinc-500">Saved projects</label>
            <select
              id="saved-projects"
              value={selectedId ?? ""}
              disabled={projectBusy}
              onChange={(event) => {
                const selected = projects.find((item) => item.id === event.target.value);
                if (selected) {
                  selectProject(selected);
                } else {
                  startNewProject();
                }
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="">Start a new project</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <form onSubmit={generateProject} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">What do you want to build?</h2>
                <p className="mt-1 text-sm text-zinc-400">Describe the experience and let AI create the starter project.</p>
              </div>
              <select
                value={projectType}
                disabled={projectBusy}
                onChange={(event) => setProjectType(event.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                aria-label="Project type"
              >
                {PROJECT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <textarea
              value={prompt}
              disabled={projectBusy}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: Build a friendly habit tracker for students, with a weekly streak view, calming colors, and a mobile-first layout."
              rows={4}
              maxLength={4000}
              required
              className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-500"
            />
            {projectType !== "game" && (
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={cameraOverlay}
                  disabled={projectBusy}
                  onChange={(event) => setCameraOverlay(event.target.checked)}
                  className="mt-1 accent-emerald-400"
                />
                <span>
                  <span className="block text-zinc-200">Camera overlay mode</span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">
                    Show the app as a floating panel over the live camera view. This is a screen-based AR effect, not a hologram.
                  </span>
                </span>
              </label>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">{prompt.length}/4000 characters</span>
              <button
                type="submit"
                disabled={projectBusy || !prompt.trim()}
                className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? "Building your project…" : "Generate project"}
              </button>
            </div>
          </form>

          {(error || notice) && (
            <div role={error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-900 bg-red-950/40 text-red-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
              {error || notice}
            </div>
          )}

          {project ? (
            <div className="flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-3 sm:px-4">
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{project.name}</h2>
                  <p className="text-xs capitalize text-zinc-500">
                    {project.kind === "android" ? "Native iOS + Android" : project.kind}
                    {" · "}
                    {isDirty ? "unsaved changes" : "saved to your projects"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {Object.keys(project.files ?? {}).length > 1 && (
                    <select
                      value={activeFile}
                      disabled={projectBusy}
                      onChange={(event) => setActiveFile(event.target.value)}
                      className="max-w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
                      aria-label="Project file"
                    >
                      {Object.keys(project.files).map((file) => <option key={file} value={file}>{file}</option>)}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={downloadProject}
                    disabled={projectBusy}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download project (.zip)
                  </button>
                  <button
                    type="button"
                    onClick={downloadFile}
                    disabled={projectBusy}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download file
                  </button>
                  <button
                    type="button"
                    onClick={saveProject}
                    disabled={!isDirty || projectBusy}
                    className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={deleteProject}
                    disabled={projectBusy}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-2">
                <div className="min-h-64 overflow-auto border-b border-zinc-800 xl:border-b-0 xl:border-r">
                  <div className="sticky top-0 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-500">{activeFile || "Source"}</div>
                  <textarea
                    aria-label={`Edit ${activeFile}`}
                    spellCheck={false}
                    disabled={projectBusy}
                    value={activeSource}
                    onChange={(event) => updateActiveFile(event.target.value)}
                    className="min-h-[400px] w-full resize-y bg-transparent p-4 font-mono text-xs leading-5 text-zinc-300 outline-none focus:ring-1 focus:ring-inset focus:ring-emerald-500"
                  />
                </div>
                <div className="flex min-h-64 flex-col">
                  <div className="border-b border-zinc-800 px-4 py-2 text-xs text-zinc-500">Web preview · sandboxed</div>
                  {previewHtml ? (
                    <>
                      {project.kind === "pwa" && (
                        <p className="border-b border-amber-900/60 bg-amber-950/30 px-4 py-2 text-xs leading-5 text-amber-200">
                          This visual preview cannot install the PWA or run its service worker. Download the project and serve it over localhost or HTTPS to test installation and offline behavior.
                        </p>
                      )}
                      <iframe
                        title={`${project.name} preview`}
                        sandbox="allow-scripts"
                        srcDoc={previewHtml}
                        className="min-h-[400px] flex-1 bg-white"
                      />
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-6">
                      <div className="max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
                        <h3 className="font-semibold text-white">Run your native app</h3>
                        <ol className="mt-3 list-inside list-decimal space-y-2 leading-6 text-zinc-400">
                          <li>Download the project files and place them in the same folder structure.</li>
                          <li>Install Node.js, then run <code className="text-emerald-300">npm install</code>.</li>
                          <li>Run <code className="text-emerald-300">npx expo start</code> and open it with Expo Go or an emulator.</li>
                          <li>Use an Expo EAS account and the generated README for store-ready builds.</li>
                        </ol>
                        <p className="mt-3 text-xs leading-5 text-zinc-500">This Studio provides editable source only; it does not compile, sign, or publish mobile binaries.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3">
                <p className="text-xs text-zinc-500">
                  {getTotalProjectSize(project.files)} &bull; Saved to your account
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadProject(project)}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-black transition-colors"
                  >
                    ↓ Export Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeploy(!showDeploy)}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-colors"
                  >
                    {showDeploy ? "Hide" : "Show"} Deploy Instructions
                  </button>
                </div>
              </div>
              {showDeploy && (
                <div className="border-t border-zinc-800 px-4 py-3 bg-black/20">
                  <h3 className="text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                    Deploy {project.kind.charAt(0).toUpperCase() + project.kind.slice(1)}
                  </h3>
                  <div className="space-y-1">
                    {getDeployInstructions(project.kind).steps.map((step, i) => (
                      <p key={i} className="text-xs text-zinc-400 leading-5">
                        {step}
                      </p>
                    ))}
                    <p className="mt-2 text-xs text-zinc-500">
                      Free hosting:{" "}
                      {getDeployInstructions(project.kind).freeHosts.join(", ")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-64 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-2xl text-emerald-300">✦</div>
              <h2 className="text-lg font-semibold">Make your idea real</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
                Generate websites, installable PWAs, browser games, or cross-platform native app source. Preview web projects, edit files, and save changes to your account.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
