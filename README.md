# NPC Strapi Module para Foundry VTT

Um módulo para Foundry VTT que permite gerenciar NPCs integrado com Strapi CMS.

## Funcionalidades

- **Aba lateral elegante**: Interface deslizante que não interfere com o jogo
- **Lazy loading**: As imagens são carregadas apenas quando você clica na campanha
- **Filtros avançados**: Filtre NPCs por nome, tipo e se é NPC ou PC
- **Integração com Strapi**: Conecta diretamente com seu servidor Strapi
- **Criação de tokens**: Clique nas imagens para criar tokens na cena ativa

## Instalação

1. Baixe o módulo e extraia na pasta `modules` do seu Foundry VTT
2. Ative o módulo nas configurações do mundo
3. Configure a URL do seu servidor Strapi nas configurações do módulo

## Configuração do Strapi

Certifique-se de que seu Strapi tenha o content-type `npcs` com a seguinte estrutura:

```json
{
  "campaign": "string",
  "type": "string", 
  "name": "string",
  "token": "media (multiple)",
  "isNPC": "boolean"
}
```

## Como usar

1. Clique no botão "NPC Nexus" na aba de Atores
2. Selecione uma campanha nas abas
3. Use os filtros para encontrar NPCs específicos
4. Clique nas imagens para criar tokens na cena ativa

## Configurações

- **URL do Strapi**: Configure a URL do seu servidor Strapi (ex: http://localhost:1337)

## Suporte

Este módulo é compatível com Foundry VTT v11 e v12.