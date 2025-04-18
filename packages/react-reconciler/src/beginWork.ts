import { ReactElementType } from 'shared/ReactType';
import { FiberNode } from './fiber';
import {
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import {
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers } from './childFiber';
import { reconcileChildFibers } from './childFiber';

// 递归中的递阶段

export const beginWork = (wip: FiberNode) => {
	// 比较，返回子 fiberNode
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState;
	const updateQueue =
		wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	// 计算完以后，update 就没有用了
	const { memoizedState } = processUpdateQueue(
		baseState,
		pending
	);
	wip.memoizedState = memoizedState;

	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function reconcileChildren(
	wip: FiberNode,
	children?: ReactElementType
) {
	const current = wip.alternate;
	if (current !== null) {
		// 更新流程/update
		wip.child = reconcileChildFibers(
			wip,
			current.child,
			children
		);
	} else {
		// 插入流程/mount，不需要追踪副作用
		wip.child = mountChildFibers(
			wip,
			null,
			children
		);
	}
}
