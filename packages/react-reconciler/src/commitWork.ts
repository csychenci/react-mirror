import {
	appendChildToContainer,
	Container
} from 'hostConfig';
import {
	FiberNode,
	FiberRootNode
} from './fiber';
import {
	MutationMask,
	NoFlags,
	Placement
} from './fiberFlags';
import {
	HostComponent,
	HostRoot,
	HostText
} from './workTags';

let nextEffects: FiberNode | null = null;

export const commitMutationEffects = (
	finishedWork: FiberNode
) => {
	// 向下遍历
	nextEffects = finishedWork;
	while (nextEffects !== null) {
		const child: FiberNode | null =
			nextEffects.child;
		if (
			(nextEffects.subtreeFlags &
				MutationMask) !==
				NoFlags &&
			child !== null
		) {
			nextEffects = child;
		} else {
			// 当前节点不存在 subtreeFlags 或者已经是叶子节点了，向上遍历 DFS
			up: while (nextEffects !== null) {
				commitMutationEffectsOnFiber(nextEffects);
				const sibling: FiberNode | null =
					nextEffects.sibling;
				if (sibling !== null) {
					nextEffects = sibling;
					break up;
				}
				nextEffects = nextEffects.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode
) => {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement; // 从 flags 中移除 Placement
	}
};

const commitPlacement = (
	finishedWork: FiberNode
) => {
	// parent Dom
	// finishedword ~~ Dom
	if (__DEV__) {
		console.warn(
			'执行 Placement 操作',
			finishedWork
		);
	}

	const hostParent = getHostParent(finishedWork);
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(
			finishedWork,
			hostParent
		);
	}
};

function getHostParent(
	fiber: FiberNode
): Container | null {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode)
				.container;
		}
		parent = parent.return;
	}

	if (__DEV__) {
		console.warn('未找到 root parent');
	}
	return null;
}

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	if (
		finishedWork.tag === HostComponent ||
		finishedWork.tag === HostText
	) {
		appendChildToContainer(
			finishedWork.stateNode,
			hostParent
		);
		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(
			child,
			hostParent
		);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(
				sibling,
				hostParent
			);
			sibling = sibling.sibling;
		}
	}
}
