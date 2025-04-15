import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
	Type,
	Key,
	Ref,
	Props,
	ReactElementType,
	ElementType
} from 'shared/ReactType';

const ReactElement = function (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		key,
		ref,
		props,
		__mark: 'react.element',
		type
	};
	return element;
};

export const jsx = (
	type: ElementType,
	config: any,
	...maybeChildren: any
) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;
	for (const prop in config) {
		const val = config[prop];
		switch (props) {
			case 'key':
				if (val !== undefined) {
					key = '' + val;
				}
				break;
			case 'ref':
				if (val !== undefined) {
					ref = val;
				}
				break;
			case {}.hasOwnProperty.call(config, prop):
				props[prop] = val;
				break;
			default:
				break;
		}
	}
	const maybeChildrenLength =
		maybeChildren.length;
	if (maybeChildrenLength) {
		if (maybeChildrenLength === 1) {
			props.children = maybeChildren[0];
		} else {
			props.children = maybeChildren;
		}
	}
	return ReactElement(type, key, ref, props);
};

export const jsxDEV = jsx;
