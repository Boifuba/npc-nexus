# NPC Nexus - Local Files

Módulo para Foundry VTT que permite gerenciar NPCs usando arquivos locais em vez de um servidor Strapi.

## Características

- **Acesso a arquivos locais**: Carrega NPCs diretamente de pastas no seu mundo Foundry
- **Interface simplificada**: Sem funcionalidades de edição complexas
- **Estrutura de pastas inteligente**: Reconhece campanha/tipo/gênero pela estrutura de pastas
- **Filtros avançados**: Filtre por nome, tipo e gênero
- **Gerador de nomes**: Inclui gerador de nomes para NPCs
- **Responsivo**: Interface adaptável a diferentes tamanhos de tela

## Instalação

1. Extraia o módulo na pasta `modules` do seu Foundry VTT
2. Ative o módulo nas configurações do mundo
3. Configure a pasta dos NPCs nas configurações do módulo

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

### Nomenclatura de Arquivos

Os nomes dos arquivos serão usados como nomes dos NPCs. Exemplos:
- `aragorn.png` → Nome: "Aragorn"
- `gandalf_o_cinzento.png` → Nome: "Gandalf o cinzento"
- `red_dragon.png` → Nome: "Red dragon"

## Como Usar

### Abrindo o Painel

1. Clique no botão "NPC Nexus" na barra lateral de atores
2. Ou use o botão na barra de controles de cena (ícone de usuários)

### Carregamento Automático

O módulo carrega automaticamente todos os NPCs da pasta configurada quando o painel é aberto.

### Criando Atores

1. Clique em qualquer NPC na grade para criar um ator automaticamente
2. O ator será criado com as informações extraídas da estrutura de pastas:
   - **Nome**: Nome do arquivo
   - **Tipo**: Nome da segunda pasta
   - **Gênero**: "male" ou "female" se estiver em pasta correspondente
   - **Campanha**: Nome da primeira pasta
3. A ficha do ator será aberta automaticamente

### Filtros

Use os filtros disponíveis para encontrar NPCs específicos:

- **Nome**: Filtra por nome do NPC
- **Tipo**: Filtra por tipo (extraído da estrutura de pastas)
- **Gênero**: Filtra por gênero (masculino/feminino)

### Menu de Contexto

Clique com o botão direito em um NPC para:
- Criar ator
- Copiar caminho do arquivo

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

## Exemplo de Script para Listar Pastas

Você pode usar este script no console do Foundry para explorar a estrutura de pastas:

```javascript
// Digite o nome da pasta aqui
let nomePasta = "npcs"; // MUDE AQUI

console.clear();
console.log(`=== LISTANDO RECURSIVO: ${nomePasta} ===`);

async function listarRecursivo(caminho, nivel = 0) {
    let indent = "  ".repeat(nivel);
    
    try {
        let response = await FilePicker.browse("data", caminho);
        
        // Lista arquivos da pasta atual
        if (response.files && response.files.length > 0) {
            response.files.forEach(file => {
                let nome = file.split('/').pop();
                console.log(`${indent}📄 ${nome}`);
            });
        }
        
        // Lista e entra nas subpastas
        if (response.dirs && response.dirs.length > 0) {
            for (let dir of response.dirs) {
                let nomePasta = dir.split('/').pop();
                console.log(`${indent}📁 ${nomePasta}/`);
                
                // Chama recursivamente para a subpasta
                await listarRecursivo(dir, nivel + 1);
            }
        }
        
    } catch (error) {
        console.log(`${indent}❌ Erro ao acessar: ${caminho}`);
    }
}

// Executa a listagem recursiva
await listarRecursivo(nomePasta);
```

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
        └── male/
            └── gandalf.png
```

O módulo criará NPCs com:
- **Aragorn**: Campanha="senhor-dos-aneis", Tipo="guerreiro", Gênero="male"
- **Eowyn**: Campanha="senhor-dos-aneis", Tipo="guerreiro", Gênero="female"  
- **Gandalf**: Campanha="senhor-dos-aneis", Tipo="mago", Gênero="male"

## Diferenças da Versão Strapi

Esta versão foi modificada para:

- ✅ Usar arquivos locais em vez de servidor Strapi
- ✅ Remover funcionalidades de edição de NPCs
- ✅ Remover internacionalização
- ✅ Remover configurações JWT
- ✅ Remover mecânicas de "isNPC" e "ocupado"
- ✅ Simplificar a interface (sem seletor de pasta na UI)
- ✅ Reconhecer estrutura de pastas automaticamente
- ✅ Manter o gerador de nomes
- ✅ Manter filtros e busca

## Suporte

Para dúvidas ou problemas, consulte a documentação do Foundry VTT sobre o FilePicker API.

## Licença

MIT License

