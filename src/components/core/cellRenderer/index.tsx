import { useTextSelectionStore } from "@/stores/textSelectionStore";

const SmartCellRenderer = (props: any) => {
  const setSelection = useTextSelectionStore((state) => state.setSelection);
  const { value, colDef } = props;

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      const selectedText = selection.toString();
      const fullText = value?.toString() || "";
      const start = fullText.indexOf(selectedText);
      const end = start + selectedText.length;

      if (start !== -1) {
        const result = {
          column: colDef.field,
          fullValue: fullText,
          selectedText,
          charRange: `${start},${end}`,
        };

        setSelection(result);

        if (props.onTextSelect) {
          props.onTextSelect(result);
        }
      }
    }
  };

  return <span onMouseUp={handleMouseUp}>{value}</span>;
};

export default SmartCellRenderer;
