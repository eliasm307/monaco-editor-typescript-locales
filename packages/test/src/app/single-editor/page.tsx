"use client";

import { HStack, Text, Textarea, VStack } from "@chakra-ui/react";
import EditorPanel from "@packages/common/src/components/EditorPanel";

export default function Page() {
  return (
    <HStack>
      <EditorPanel editor={{ languageId: "javascript", value: "console.log('hello world')" }} />
      <VStack>
        <Textarea />
        <Text className='markers-data-container'></Text>
      </VStack>
    </HStack>
  );
}
