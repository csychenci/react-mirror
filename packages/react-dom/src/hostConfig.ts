export type Container = Element;
export type Instance = Element;

export const createInstance = (type: string): Instance => {
  const element = document.createElement(type);
  return element
};

export const appendInitialChild = (
  parent: Instance,
  child: Instance
) => {
  parent.appendChild(child);
};

export const createTextInstance = (
  content: string
) => {
  return document.createTextNode(content);
};

export const appendChildToContainer = (
  child: Instance,
  parent: Instance,
) => {
  parent.appendChild(child);
};
