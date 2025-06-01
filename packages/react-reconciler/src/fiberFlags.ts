export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000010;
export const Update = 0b0000100;
export const ChildDeletion = 0b00010000;

export const PassiveEffect = 0b000100000;
// 代表 fiber 上本次更新存在需要触发 useEffect 的情况
export const Ref = 0b001000000;

export const MutationMask =
	Placement | Update | ChildDeletion | Ref;

export const PassiveMask =
	PassiveEffect | ChildDeletion;

export const LayoutMask = Ref;
