import { FiberNode } from 'react-reconciler/src/fiber';
import {
	HostComponent,
	HostText
} from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactType';
import {
	DOMElement,
	updateFiberProps
} from './SyntheticEvent';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;
export const createInstance = (
	type: string,
	props: Props
): Instance => {
	const element = document.createElement(type);
	updateFiberProps(
		element as unknown as DOMElement,
		props
	);
	return element;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const createTextInstance = (
	content: string
) => {
	return document.createTextNode(content);
};

export const appendChildToContainer =
	appendInitialChild;

export const commitUpdate = (
	fiber: FiberNode
) => {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps.content;
			return commitTextUpdate(
				fiber.stateNode,
				text
			);
		case HostComponent:
			return updateFiberProps(
				fiber.stateNode,
				fiber.memoizedProps
			);
		default:
			if (__DEV__) {
				console.warn(
					'未实现的 update 类型',
					fiber
				);
			}
			break;
	}
};

export function commitTextUpdate(
	textInstance: TextInstance,
	content: string
) {
	textInstance.textContent = content;
}

export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	container.removeChild(child);
}

export function insertChildToContainer(
	child: Instance,
	container: Container,
	before: Instance
) {
	container.insertBefore(child, before);
}

export const scheduleMicroTask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
			? (callback: (...args: any) => void) =>
					Promise.resolve(null).then(callback)
			: setTimeout;
