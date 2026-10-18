// Contas de usuário (nome de usuário e senha, ou Google) usam um projeto do Firebase no plano
// grátis: Authentication (provedores "E-mail/senha" e "Google") + Firestore. Como criar: README →
// "Ativar as contas".
// Estes valores são públicos por natureza (vão para o navegador de todo mundo); quem protege os
// dados são as regras do Firestore (firestore.rules). Vazio = contas desligadas no jogo.
export default {
  apiKey: 'AIzaSyAEl4cd0bEH98orOdHznjeskrApzUaNSsI',
  projectId: 'diveprop',
};
