import type { BoxProps } from "@chakra-ui/react";
import { Heading, Text, VStack } from "@chakra-ui/react";
import type { editor } from "monaco-editor";
import { serialiseMarkers } from "../utils";

export default function AllMarkersDataPanel({
  markers,
  ...boxProps
}: { markers: editor.IMarker[] } & BoxProps) {
  return (
    <VStack
      className='editor-markers-panel'
      height='100%'
      overflow='auto'
      width='100%'
      {...boxProps}
    >
      <Heading as='h3' size='md'>
        Markers
      </Heading>
      {markers.length && (
        <Text
          as='pre'
          id='editor-markers-data-container'
          flex={1}
          overflow='auto'
          whiteSpace='pre-wrap'
          width='100%'
        >
          {serialiseMarkers(markers)}
        </Text>
      )}
    </VStack>
  );
}
