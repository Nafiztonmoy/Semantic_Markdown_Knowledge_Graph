export function headingId(text: string) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}
export function documentHref(workspaceId: string, item: {
  document_id: string;
  section_id?: string;
  heading_path?: string;
}) {
  const anchor = item.section_id ? `section-${item.section_id}` : headingId(item.heading_path?.split(' > ').pop() || '');
  return `/workspaces/${workspaceId}/documents/${item.document_id}${anchor ? '#' + encodeURIComponent(anchor) : ''}`;
}
