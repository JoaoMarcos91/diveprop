// Contas de usuário (login com nome de usuário e senha) usam um projeto do Firebase no plano
// grátis: Authentication (provedor "E-mail/senha") + Firestore. Como criar: README → "Contas".
// Estes valores são públicos por natureza (vão para o navegador de todo mundo); quem protege os
// dados são as regras do Firestore (firestore.rules). Vazio = contas desligadas no jogo.
export default {
  apiKey: '',
  projectId: '',
};
