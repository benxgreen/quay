import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { TagGroup } from "@/components/ui/tag";

const meta = {
	title: "Service/Replacements/Type tag",
	component: TypeTag,
	args: { type: "collection" },
} satisfies Meta<typeof TypeTag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Blue "Collection", purple "Session": always colour plus the word. In sentences, write the type as plain words. */
export const Both: Story = {
	render: () => (
		<TagGroup>
			<TypeTag type="collection" />
			<TypeTag type="session" />
		</TagGroup>
	),
};
