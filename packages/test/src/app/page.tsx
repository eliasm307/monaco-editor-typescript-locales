import { VStack } from "@chakra-ui/react";
import Link from "next/link";

export default function Home() {
  return (
    <VStack>
      <Link href='/single-editor'>Single Editor</Link>
    </VStack>
  );
}
