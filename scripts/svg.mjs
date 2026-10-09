export function svgDocument({width,height,base,overlay,title}){
 const escaped=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${escaped}</title><desc>Watercolor botanical artwork. Embedded images only; no scripts or external resources.</desc><image href="${base}" width="100%" height="100%"/>${overlay?`<image href="${overlay}" width="100%" height="100%" opacity="0"><animate attributeName="opacity" values="0;0.14;0" dur="6s" repeatCount="indefinite"/></image>`:''}</svg>\n`;
}
