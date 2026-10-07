"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { MarkdownEditor } from "@/components/MarkdownEditor";
export default function NewDocumentPage({
  params
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const resolvedParams = use(params);
  const workspaceId = resolvedParams.id;
  const router = useRouter();
  return <MarkdownEditor workspaceId={workspaceId} isNew={true} onSaveSuccess={createdDoc => {
    router.push(`/workspaces/${workspaceId}/documents/${createdDoc.id}`);
  }} />;
}
