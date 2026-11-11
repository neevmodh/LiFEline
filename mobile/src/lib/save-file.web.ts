// Web build: a normal browser download.
export async function saveTextFile(name: string, contents: string, mimeType: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
