"use client";

import "@/components/ui/button/button.css";
import "@/components/ui/form-group/form-group.css";
import "./add-another.css";

import { useEffect, useId, useRef, useState } from "react";

type AddAnotherProps = {
	/** Field name. Every box is submitted under it, in order. */
	name: string;
	/** Label for each box, numbered: "Software" gives "Software 1", "Software 2". */
	itemLabel: string;
	/** Values to start with. One empty box when there are none. */
	defaultValues?: string[];
	/** Button text, such as "Add another" or "Add another application". */
	addText?: string;
	/** Most boxes allowed. */
	max?: number;
};

/**
 * Repeating free-text boxes, one item per box, such as software someone
 * needs that is not on the list. Remove buttons are named for screen
 * readers ("Remove software 2"). Focus moves to a new box when one is added,
 * and to the next box (or the Add button) when one is removed. Put it in a
 * fieldset with its own legend and hint.
 *
 * @example
 * <AddAnother name="otherSoftware" itemLabel="Software" defaultValues={["Planning Portal connector"]} />
 */
export function AddAnother({
	name,
	itemLabel,
	defaultValues = [],
	addText = "Add another",
	max = 20,
}: AddAnotherProps) {
	const baseId = useId();
	const nextKey = useRef(0);
	const makeItem = (value: string) => ({ key: nextKey.current++, value });
	const [items, setItems] = useState(() =>
		(defaultValues.length ? defaultValues : [""]).map(makeItem),
	);
	const containerRef = useRef<HTMLDivElement>(null);
	const addRef = useRef<HTMLButtonElement>(null);
	// Which box to focus once the list has re-rendered after an add or remove.
	const focusIndex = useRef<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs after each change to the boxes, once they are in the DOM
	useEffect(() => {
		if (focusIndex.current === null) {
			return;
		}
		const boxes = containerRef.current?.querySelectorAll<HTMLInputElement>("input") ?? [];
		const box = boxes[Math.min(focusIndex.current, boxes.length - 1)];
		(box ?? addRef.current)?.focus();
		focusIndex.current = null;
	}, [items]);

	const focusBox = (index: number) => {
		focusIndex.current = index;
	};

	const add = () => {
		setItems((current) => [...current, makeItem("")]);
		focusBox(items.length);
	};

	const remove = (key: number) => {
		const index = items.findIndex((item) => item.key === key);
		setItems((current) => {
			const next = current.filter((item) => item.key !== key);
			return next.length ? next : [makeItem("")];
		});
		focusBox(index);
	};

	const update = (key: number, value: string) =>
		setItems((current) =>
			current.map((item) => (item.key === key ? { ...item, value } : item)),
		);

	return (
		<div className="bcp-add-another" ref={containerRef}>
			{items.map((item, index) => {
				const id = `${baseId}-${item.key}`;
				const label = `${itemLabel} ${index + 1}`;

				return (
					<div key={item.key} className="bcp-add-another-item">
						<div className="bcp-add-another-field">
							<label className="bcp-label" htmlFor={id}>
								{label}
							</label>
							<input
								className="bcp-input"
								id={id}
								name={name}
								type="text"
								value={item.value}
								onChange={(event) => update(item.key, event.target.value)}
							/>
						</div>
						{items.length > 1 || item.value ? (
							<button
								type="button"
								className="bcp-add-another-remove"
								onClick={() => remove(item.key)}
							>
								Remove <span className="sr-only">{label.toLowerCase()}</span>
							</button>
						) : null}
					</div>
				);
			})}
			{items.length < max ? (
				<button
					ref={addRef}
					type="button"
					className="bcp-button bcp-button--secondary bcp-add-another-add"
					onClick={add}
				>
					{addText}
				</button>
			) : null}
		</div>
	);
}
