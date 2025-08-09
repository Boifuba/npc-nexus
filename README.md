# NPC Nexus - Local Files

Módulo para Foundry VTT que permite gerenciar NPCs usando arquivos locais em vez de um servidor Strapi.

## Características

- **Acesso a arquivos locais**: Carrega as imagens de NPCs diretamente de pastas pré-setadas no seu mundo Foundry
- **Interface simplificada**: Sem funcionalidades de edição complexas
- **Estrutura de pastas inteligente**: Reconhece campanha/tipo/gênero pela estrutura de pastas
- **Filtros avançados**: Filtre por nome, tipo e gênero
- **Gerador de nomes**: Inclui gerador de nomes para NPCs
- **Responsivo**: Interface adaptável a diferentes tamanhos de tela e posição

## Instalação

1. Extraia o módulo na pasta `modules` do seu Foundry VTT
2. Ative o módulo nas configurações do mundo
3. Configure a pasta dos NPCs nas configurações do módulo


ou 

1. Instale usando o module.json dentro da parte de instação de módulos.

## Configuração

### Pasta dos NPCs

Nas configurações do módulo, defina o caminho da pasta onde estão os arquivos de imagem dos NPCs. Por exemplo: `npcs`

### Estrutura de Pastas

O módulo reconhece automaticamente a estrutura de pastas seguindo o padrão:

```
npcs/                    <- Pasta raiz (configurada nas settings)
├── campanha1/           <- Primeira pasta = CAMPANHA
│   ├── guerreiro/       <- Segunda pasta = TIPO
│   │   ├── male/        <- Pasta "male" = GÊNERO masculino
│   │   │   ├── aragorn.png
│   │   │   └── boromir.png
│   │   └── female/      <- Pasta "female" = GÊNERO feminino
│   │       ├── eowyn.png
│   │       └── arwen.png
│   ├── mago/
│   │   ├── male/
│   │   │   └── gandalf.png
│   │   └── female/
│   │       └── galadriel.png
│   └── ladino/
│       └── male/
│           └── legolas.png
├── campanha2/
│   ├── clerigo/
│   │   └── female/
│   │       └── priestess.png
│   └── barbaro/
│       └── male/
│           └── conan.png
└── monstros/            <- Outra campanha
    ├── dragao/
    │   └── red_dragon.png
    └── orc/
        ├── male/
        │   └── orc_warrior.png
        └── female/
            └── orc_shaman.png
```

### Regras de Estrutura

1. **Primeira pasta** = Nome da **Campanha**
2. **Segunda pasta** = **Tipo** do NPC (guerreiro, mago, ladino, etc.)
3. **Pastas "male" ou "female"** = **Gênero** (usado apenas para filtros)



## Como Usar

### Abrindo o Painel

1. Clique no botão "NPC Nexus" na barra lateral de atores
2. Ou use o botão na barra de controles de cena (ícone de usuários)

### Carregamento Automático

O módulo carrega automaticamente todos os NPCs da pasta configurada quando o painel é aberto.


### Filtros

Use os filtros disponíveis para encontrar NPCs específicos:

- **Nome**: Filtra por nome do NPC
- **Tipo**: Filtra por tipo (extraído da estrutura de pastas)
- **Gênero**: Filtra por gênero (masculino/feminino)

### Menu de Contexto

Clique na imagem de um NPC para :
- Trocar a imagem dos atores selecionados

> Se você estiver com mais de um token selecionado o módulo vai aplicar uma imagem  de dentro da pasta para cada um randomicamente até não ter mais imagens disponiveis então ele irá setar imagens repetidas

## Gerador de Nomes

O módulo inclui um gerador de nomes que pode ser acessado:
- Pelo botão de dados no cabeçalho do painel
- Pelo botão na barra de controles de cena

## Configurações Disponíveis

### Configurações do Mundo

- **Pasta dos NPCs**: Caminho da pasta onde estão os arquivos de imagem

### Configurações do Cliente

- **Tamanho das Imagens**: Controla o tamanho dos tokens no painel
- **Lado do Painel**: Escolhe se o painel aparece à direita ou esquerda

## Formatos de Imagem Suportados

- JPG/JPEG
- PNG
- GIF
- BMP
- WebP
- SVG



## Exemplo Prático

Se você tem esta estrutura:
```
npcs/
└── senhor-dos-aneis/
    ├── guerreiro/
    │   ├── male/
    │   │   └── aragorn.png
    │   └── female/
    │       └── eowyn.png
    └── mago/
    |    └── male/
    |        └── gandalf.png
    └── qualquer /
        └── john-doe.png
        
        
```

O módulo criará NPCs com:
- **Aragorn**: Campanha="senhor-dos-aneis", Tipo="guerreiro", Gênero="male"
- **Eowyn**: Campanha="senhor-dos-aneis", Tipo="guerreiro", Gênero="female"  
- **Gandalf**: Campanha="senhor-dos-aneis", Tipo="mago", Gênero="male"
- **John Doe**: Campanha="senhor-dos-aneis", Tipo="qualquer"


## Suporte

Para dúvidas ou problemas, consulte a documentação do Foundry VTT sobre o FilePicker API.

## Licença

MIT License

