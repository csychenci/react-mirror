import {
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	HostRoot,
	HostComponent,
	HostText
} from './workTags';
import { NoFlags } from './fiberFlags';

export const completeWork = (wip: FiberNode) => {
	// 收集副作用
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// 更新 update
			} else {
				// 1. 构建 DOM
				const instance = createInstance(
					wip.type,
					newProps
				);
				// 2. 将 DOM 插入到 DOM 树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// 更新 update
			} else {
				// 1. 构建 DOM
				const instance = createTextInstance(
					newProps?.content
				);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork', wip);
			}
			break;
	}
};

function appendAllChildren(
	parent: FiberNode,
	wip: FiberNode
) {
	let node = wip.child;
	while (node !== null) {
		if (
			node?.tag === HostComponent ||
			node?.tag === HostText
		) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node?.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			if (
				node.return === null ||
				node.return === wip
			) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;
	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags = subtreeFlags;
}
