import {
  ATTACHMENT_ACCEPT,
  MAX_UPLOAD_BYTES,
  attachmentTypeFor,
  commentMarker,
  downloadUrl,
  exceedsUploadLimit,
  isAllowedAttachment,
  parseCommentBody,
} from './uploads';

describe('uploads util', () => {
  it('exceedsUploadLimit: 5 MB exactos pasa, un byte más no', () => {
    expect(exceedsUploadLimit({ size: MAX_UPLOAD_BYTES })).toBeFalse();
    expect(exceedsUploadLimit({ size: MAX_UPLOAD_BYTES + 1 })).toBeTrue();
  });

  it('isAllowedAttachment acepta imagen/video por MIME y documentos por extensión', () => {
    expect(isAllowedAttachment({ name: 'foto.png', type: 'image/png' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'clip.mp4', type: 'video/mp4' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'doc.PDF', type: 'application/pdf' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.zip', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.rar', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.psd', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.ai', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.docx', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.xlsx', type: '' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'a.csv', type: 'text/csv' })).toBeTrue();
    expect(isAllowedAttachment({ name: 'virus.exe', type: 'application/x-msdownload' })).toBeFalse();
    expect(isAllowedAttachment({ name: 'sinextension', type: '' })).toBeFalse();
  });

  it('ATTACHMENT_ACCEPT incluye MIME genéricos y las extensiones', () => {
    expect(ATTACHMENT_ACCEPT).toContain('image/*');
    expect(ATTACHMENT_ACCEPT).toContain('video/*');
    expect(ATTACHMENT_ACCEPT).toContain('.zip');
    expect(ATTACHMENT_ACCEPT).toContain('.docx');
  });

  it('attachmentTypeFor clasifica video, imagen y archivo', () => {
    expect(attachmentTypeFor({ name: 'v.mp4', type: 'video/mp4' })).toBe('video');
    expect(attachmentTypeFor({ name: 'f.png', type: 'image/png' })).toBe('image');
    expect(attachmentTypeFor({ name: 'd.pdf', type: 'application/pdf' })).toBe('file');
  });

  it('commentMarker genera ![..](..) para imágenes y [..](..) para el resto', () => {
    expect(commentMarker('foto.png', 'https://x/a.png', true)).toBe('![foto.png](https://x/a.png)');
    expect(commentMarker('doc.pdf', 'https://x/a.pdf', false)).toBe('[doc.pdf](https://x/a.pdf)');
    expect(commentMarker('ra[ro].pdf', 'https://x/a.pdf', false)).toBe('[raro.pdf](https://x/a.pdf)');
  });

  it('parseCommentBody separa texto, imágenes, videos y archivos', () => {
    const body =
      'hola\n![foto.png](https://x/f.png)\n[clip.mp4](https://x/c.mp4)\n[doc.pdf](https://x/d.pdf)\nchau';
    expect(parseCommentBody(body)).toEqual([
      { type: 'text', value: 'hola' },
      { type: 'image', value: 'https://x/f.png', name: 'foto.png' },
      { type: 'video', value: 'https://x/c.mp4', name: 'clip.mp4' },
      { type: 'file', value: 'https://x/d.pdf', name: 'doc.pdf' },
      { type: 'text', value: 'chau' },
    ]);
  });

  it('parseCommentBody mantiene compatibilidad con comentarios antiguos y texto plano', () => {
    expect(parseCommentBody('![imagen](https://x/a.png)')).toEqual([
      { type: 'image', value: 'https://x/a.png', name: 'imagen' },
    ]);
    expect(parseCommentBody('solo texto')).toEqual([{ type: 'text', value: 'solo texto' }]);
  });

  it('downloadUrl añade ?download= con el nombre codificado', () => {
    expect(downloadUrl('https://x/a.pdf', 'mi doc.pdf')).toBe('https://x/a.pdf?download=mi%20doc.pdf');
    expect(downloadUrl('https://x/a.pdf?v=1', 'a.pdf')).toBe('https://x/a.pdf?v=1&download=a.pdf');
  });
});
