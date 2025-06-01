import { ReactElementType } from 'shared/ReactType';
import { FiberNode } from './fiber';
import {
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import {
	HostComponent,
	HostRoot,
	HostText,
	FunctionComponent,
	Fragment,
	ContextProvider
} from './workTags';
import { mountChildFibers } from './childFiber';
import { reconcileChildFibers } from './childFiber';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { Ref } from './fiberFlags';
import { pushProvider } from './fiberContext';
// 递归中的递阶段

export const beginWork = (
	wip: FiberNode,
	renderLane: Lane
) => {
	// 比较，返回子 fiberNode
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(
				wip,
				renderLane
			);
		case Fragment:
			return updateFragment(wip);
		case ContextProvider:
			return updateContextProvider(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(
	wip: FiberNode,
	renderLane: Lane
) {
	const baseState = wip.memoizedState;
	const updateQueue =
		wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	// 计算完以后，update 就没有用了
	const { memoizedState } = processUpdateQueue(
		baseState,
		pending,
		renderLane
	);
	wip.memoizedState = memoizedState;

	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	console.log('nextChildren', nextChildren);
	markRef(wip.alternate, wip);
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

function updateFunctionComponent(
	wip: FiberNode,
	renderLane: Lane
) {
	const nextChildren = renderWithHooks(
		wip,
		renderLane
	);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateContextProvider(wip: FiberNode) {
	const providerType = wip.type;
	const context = providerType._context;
	const newProps = wip.pendingProps;
	pushProvider(context, newProps.value);
	const nextChildren = newProps.children;
	console.log('nextChildren', nextChildren);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function markRef(
	current: FiberNode | null,
	workInProgress: FiberNode
) {
	const ref = workInProgress.ref;
	console.log('markRef', current, workInProgress);
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}
