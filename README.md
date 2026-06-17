# `👾 SHERLOOK`

## `🚛 Description du workflow`

### `Phase 1️⃣ : initialisation`

#### `🟣 Collecte des fichiers soumis par les chercheurs`

Chaque collection de fichiers soumis par le chercheur est stockée dans un dépôt
[Git LFS](https://www.w3schools.com/git/git_lfs.asp). Pour les agents du CNRS,
on pourra utiliser [src.koda.cnrs.fr](https://src.koda.cnrs.fr/).

Les fichiers soumis par le chercheur doivent être « mis à plat » dans un
répertoire (qui ne doit donc contenir aucun sous-dossier. Le chercheur a pour
responsabilité de nommer ses fichiers de sorte que leur ordre au sein de ce
dossier soit signifiant. Ces fichiers doivent être rassemblés dans un dossier
`/raw` à la racine du dépôt. Par exemple, pour
[cette collection](https://github.com/sherlock-iremus/sherlook-example-collection),
les fichiers soumis par le chercheur sont rassemblés dans
[ce dossier](https://github.com/sherlock-iremus/sherlook-example-collection/tree/main/raw).

#### `🟣 Déclaration de la collection dans Grist`

Dans une table `collections` :

|                  UUID                  |   Nom   |                                  URL                                  |
| :------------------------------------: | :-----: | :-------------------------------------------------------------------: |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | Pokédex | https://github.com/sherlock-iremus/sherlook-example-collection |

#### `🟣 Déclaration du contenu de la collection dans Grist`

Exécution du script [1](./scripts/1.ts), qui va nourrir la table `files` :

|               Collection               |  Dir |  name | extension    | UUID | MD5 | Pages | E42 Nakala DOI |
| :------------------------------------: | :-------------: | :--: | :--: | :--: | :-: | :---: | :------------: |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `raw` | `pokedex-1` | `pdf`     |     |       |                |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `raw` |`pokedex-2` | `pdf`    |     |       |                |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `raw` |`pokedex-3` |  `pdf`    |     |       |                |

```sh
bash scripts/1.sh 3317dbd4-e75b-42d2-8d43-dd3cd39634fe /Users/iremus/Dev/sherlook-example-collection
```

#### `🟣 Génération des fichiers dérivés`

Tous les fichiers dérivés sont créés dans un dossier `/gen`
([par exemple](https://github.com/sherlock-iremus/sherlook-example-collection/tree/main/gen)).

##### `Un fichier PDF par page`

Exécution du script [2.1](./scripts/2.1.ts) qui va, pour chaque fichier PDF dans
`/raw`, donner lieu à la génération d'un fichier PDF par page.

```
/gen/pokedex-1-01.pdf
/gen/pokedex-1-02.pdf
…
/gen/pokedex-1-50.pdf
/gen/pokedex-2-01.pdf
...
/gen/pokedex-3-51.pdf
```

```sh
deno scripts/2.1.ts --repo /Users/iremus/Dev/sherlook-example-collection
```

##### `Un fichier png par page`

Exécution du script [2.2.1](2.2.1.sh) qui génère un fichier PNG par page.

```sh
sh scripts/2.2.1.sh /Users/iremus/Dev/sherlook-example-collection
```

```
/gen/pokedex-1-01.png
/gen/pokedex-1-02.png
…
/gen/pokedex-1-50.png
/gen/pokedex-2-01.png
...
/gen/pokedex-3-51.png
```

Exécution du script [2.2.2](2.2.2.ts) qui recense les groupes d'images générées
dans Grist (autant d'entrées que de fichiers dans `/raw`) :

|               Collection               |  filenames  |                  UUID                  | E42 Nakala DOI |
| :------------------------------------: | :---------: | :------------------------------------: | :------------: |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `pokedex-1` | `a8c6b81b-bac4-400b-a102-84d3850c4e80` |                |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `pokedex-2` | `dd50ef07-7052-4992-ac27-f5fc309dac92` |                |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `pokedex-3` | `0a3e0029-475d-4848-9a8d-591308a807d9` |                |

##### `Texte OCRisé`

```
/gen/pokedex-1.txt
/gen/pokedex-1-01.txt
/gen/pokedex-1-02.txt
…
/gen/pokedex-1-50.txt
/gen/pokedex-2.txt
/gen/pokedex-2-01.txt
...
/gen/pokedex-3.txt
...
/gen/pokedex-3-51.txt
```

```
sh scripts/2.3.?
```

#### `🟣 Création de la structure sémantique de la collection`

### `Phase 2️⃣ : extraction de nouvelles connaissances`

### `Phase 3️⃣ : publication`

## Corpus test

- https://src.koda.cnrs.fr/thomas.bottini.1/catalogue-motet-imprime#
- https://src.koda.cnrs.fr/thomas.bottini.1/correspondance-saint-saens/
- https://src.koda.cnrs.fr/thomas.bottini.1/koechlin-ephemerides

<!--```mermaid
    flowchart TB
    grist[👩‍🔬<br>Saisie des données dans Grist<br>+<br><a target="_blank" href="https://github.com/sherlock-iremus/sherlock-grist-to-crm/blob/main/doc/mapping.md">Conventions de mapping</a>]
    scripts[⚙️<br>Conversaion des données tabulaires → RDF/CIDOC CRM]
    sparql[🌐<br>Mise à disposition des données via un SPARQL endpoint]
    sherlock[🍱<br>Publication/exploration des données dans Sherlock App]

    grist - -> scripts
    scripts - -> sparql
    sparql - -> sherlock

```-->
