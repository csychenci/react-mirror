import {
	unstable_getCurrentPriorityLevel,
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority
} from 'scheduler';
import { FiberRootNode } from './fiber';
import ReactCurrentBatchConfig from 'react/src/currentBatchConfig';

export type Lane = number;
export type Lanes = number;

export const NoLane = 0b00000;
export const SyncLane = 0b00001;
export const NoLanes = 0b00000;
export const InputContinuousLane = 0b00010;
export const DefaultLane = 0b00100;
export const TransitionLane = 0b01000;
export const IdleLane = 0b10000;

export function mergeLanes(
	laneA: Lane,
	laneB: Lane
): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
	const isTransition =
		ReactCurrentBatchConfig.transition !== null;
	if (isTransition) {
		return TransitionLane;
	}
	// 从上下文环境中获取 Scheduler 优先级
	const currentSchedulerPriority =
		unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(
		currentSchedulerPriority
	);
	return lane;
}

export function getHighestPriorityLane(
	lanes: Lanes
): Lane {
	return lanes & -lanes;
}

export function isSubsetOfLanes(
	set: Lanes,
	subSet: Lane
) {
	return (subSet & set) === subSet;
}

export function markRootFinished(
	root: FiberRootNode,
	lane: Lane
) {
	root.pendingLanes &= ~lane;
	// if (root.pendingLanes === NoLanes) {
	// 	root.callbackPriority = NoLane;
	// }
}

export function lanesToSchedulerPriority(
	lanes: Lanes
) {
	const lane = getHighestPriorityLane(lanes);
	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}
	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}
	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}
	return unstable_IdlePriority;
}

function schedulerPriorityToLane(
	priority: number
) {
	if (priority === unstable_ImmediatePriority) {
		return SyncLane;
	}
	if (
		priority === unstable_UserBlockingPriority
	) {
		return InputContinuousLane;
	}
	if (priority === unstable_NormalPriority) {
		return DefaultLane;
	}
	return NoLane;
}
