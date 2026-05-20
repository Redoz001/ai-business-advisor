import React from 'react';
// 1. Import the new Reuben AI component
import ReubenAI from './components/ReubenAI';

function App() {
  return (
    <div className="app-container">
      {/* Your existing layout elements can stay here */}
      
      {/* 2. Drop the AI component wherever you want it to appear */}
      <ReubenAI />
      
    </div>
  );
}

export default App;