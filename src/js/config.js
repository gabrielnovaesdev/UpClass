// Contatos da loja — preencha aqui e o site inteiro se atualiza (rodapé, menu, botões).
// Campos vazios aparecem como "em breve".
export const CONTACT = {
  // só números, com DDI e DDD. Ex.: '5521999999999'
  whatsapp: '',
  // sem o @. Ex.: 'upclassphone'
  instagram: '',
  // endereço da loja física, em uma linha
  address: '',
  // link do Google Maps para o endereço (opcional)
  maps: '',
  region: 'Baixada Fluminense — RJ',
};

const links = {
  whatsapp: (v) => `https://wa.me/${v}`,
  instagram: (v) => `https://instagram.com/${v}`,
  address: () => CONTACT.maps || '',
};
const labels = {
  whatsapp: (v) => `+${v.slice(0, 2)} ${v.slice(2, 4)} ${v.slice(4, -4)}-${v.slice(-4)}`,
  instagram: (v) => `@${v}`,
  address: (v) => v,
};

// <a data-contact="whatsapp"><span data-contact-value>em breve</span></a>
export function applyContacts(root = document) {
  root.querySelectorAll('[data-contact]').forEach((el) => {
    const key = el.dataset.contact;
    const value = CONTACT[key];
    const out = el.querySelector('[data-contact-value]');
    if (!value) {
      el.classList.add('is-soon');
      return;
    }
    if (out) out.textContent = labels[key](value);
    el.classList.remove('is-soon');
    const href = links[key](value);
    if (href && el.tagName === 'A') {
      el.href = href;
      el.target = '_blank';
      el.rel = 'noopener';
    }
  });
}
