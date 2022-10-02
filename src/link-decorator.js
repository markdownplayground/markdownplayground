import React from "react";

const Link = ({ entityKey, contentState, children }) => {
  const { url } = contentState.getEntity(entityKey).getData();
  return (
    <a
      className="link"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
      aria-label={url}
    >
      {children}
    </a>
  );
};

const linkStrategy = (contentBlock, callback, contentState) => {
  contentBlock.findEntityRanges((character) => {
    const entityKey = character.getEntity();
    return (
      entityKey !== null &&
      contentState.getEntity(entityKey).getType() === "LINK"
    );
  }, callback);
};

export const createLinkDecorator = () => ({
  strategy: linkStrategy,
  component: Link,
});
