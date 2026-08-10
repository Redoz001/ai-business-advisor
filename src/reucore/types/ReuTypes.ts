export type ReuVector3 = {
  x: number;
  y: number;
  z: number;
};

export type ReuMaterial = {
  name: string;
  properties: {
    color?: string;
    transparency?: number;
    reflectivity?: number;
    glow?: number;
    roughness?: number;
    metallic?: number;
  };
};

export type ReuPart = {
  name: string;
  shape: "sphere" | "box" | "cylinder" | "cone" | "plane" | "custom";
  scale: ReuVector3;
  position: ReuVector3;
  material?: ReuMaterial;
};

export type ReuEntity = {
  id: string;
  name: string;
  category: string;
  parts: ReuPart[];
  material?: ReuMaterial;
  position: ReuVector3;
  scale: ReuVector3;
};

export type ReuRelationship = {
  from: string;
  relation:
    | "above"
    | "below"
    | "behind"
    | "in-front-of"
    | "holding"
    | "sitting-on"
    | "flying-over"
    | "connected-to"
    | "near";
  to: string;
};

export type ReuScene = {
  id: string;
  title: string;
  prompt: string;
  entities: ReuEntity[];
  relationships: ReuRelationship[];
  background: {
    type: "solid" | "gradient" | "environment";
    value: string;
  };
  style: {
    name: string;
    mood: string;
    palette: string[];
  };
};