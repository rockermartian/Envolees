/// <reference types="vite/client" />

// Le code partagé (core/images/imageStore.ts) détecte l'application de bureau par window.electronAPI ;
// dans la version web, il est toujours absent.
interface Window {
    electronAPI?: { putImage(bytes: Uint8Array, mime: string): Promise<string> };
}
