const supportSymbol =
	typeof Symbol === 'function' &&
	typeof Symbol.for === 'function';

// 如果支持Symbol，则使用Symbol.for来创建一个唯一的Symbol，否则使用一个固定的数字
export const REACT_ELEMENT_TYPE = supportSymbol
	? Symbol.for('react.element')
	: 0xeac7;

export const REACT_FRAGMENT_TYPE = supportSymbol
	? Symbol.for('react.fragment')
	: 0xaecb;
