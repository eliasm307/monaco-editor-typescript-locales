import { VStack } from "@chakra-ui/react";
import Link from "next/link";
import { SINGLE_EDITOR_PAGE_PATH } from "./single-editor/SingleEditorPageObject";
import { MULTIPLE_EDITORS_PAGE_PATH } from "./multiple-editors/MultipleEditorsPageObject";

export default function Home() {
  return (
    <VStack p={10}>
      <Link href={SINGLE_EDITOR_PAGE_PATH}>Single Editor</Link>
      <Link href={MULTIPLE_EDITORS_PAGE_PATH}>Multiple Editors</Link>
    </VStack>
  );
}
