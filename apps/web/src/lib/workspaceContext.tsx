"use client";

import { createContext, useContext } from "react";
export const WorkspaceContext = createContext<{
  workspace: any;
  refresh: () => void;
}>({
  workspace: null,
  refresh: () => {}
});
export const useWorkspace = () => useContext(WorkspaceContext);
