import React, { useEffect } from 'react';

const ChatComponent = ({ plugin, app }) => {
  const [hasScribe, setHasScribe] = React.useState(false);
  const [scribeActive, setScribeActive] = React.useState(false);

  useEffect(() => {
    const handler = () => {
      setHasScribe(!!plugin.backgroundScribe);
      setScribeActive(plugin.backgroundScribe?.isActiveState ?? false);
    };
    const ref = app.workspace.on("zenith-ai:background-scribe-changed" as any, handler);
    return () => app.workspace.offref(ref);
  }, [app.workspace, plugin]);

  // ... rest of the component 
};

export default ChatComponent;