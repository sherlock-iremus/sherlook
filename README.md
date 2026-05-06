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
[cette collection](https://src.koda.cnrs.fr/thomas.bottini.1/sherlook-example-collection),
les fichiers soumis par le chercheur sont rassemblés dans
[ce dossier](https://src.koda.cnrs.fr/thomas.bottini.1/sherlook-example-collection/-/tree/main/raw?ref_type=heads).

#### `🟣 Déclaration de la collection dans Grist`

Dans une table `collections` :

|                  UUID                  |   Nom   |                                  URL                                  |
| :------------------------------------: | :-----: | :-------------------------------------------------------------------: |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | Pokédex | https://src.koda.cnrs.fr/thomas.bottini.1/sherlook-example-collection |

#### `🟣 Déclaration du contenu de la collection dans Grist`

Exécution du script [1](./scripts/1.ts), qui va nourrir la table `raw` :

|               Collection               |       Nom       | UUID | MD5 | Pages |
| :------------------------------------: | :-------------: | :--: | :-: | :---: |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `pokedex-1.pdf` |      |     |       |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `pokedex-2.pdf` |      |     |       |
| `df9ae56d-382a-4359-9a55-d668245b6e5e` | `pokedex-3.pdf` |      |     |       |

```sh
bash scripts/1.sh 3317dbd4-e75b-42d2-8d43-dd3cd39634fe /Users/iremus/Dev/sherlook-example-collection
```

#### `🟣 Génération des fichiers dérivés`

Tous les fichiers dérivés sont créés dans un dossier `/gen`
([par exemple](https://src.koda.cnrs.fr/thomas.bottini.1/sherlook-example-collection/-/tree/main/gen?ref_type=heads)).

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
deno scripts/2.1.ts --repo /Users/amleth/repositories/sherlook-example-collection
```

##### `Un fichier png par page`

Exécution du script [2.2](2.2.sh).

```
/gen/pokedex-1-01.png
/gen/pokedex-1-02.png
…
/gen/pokedex-1-50.png
/gen/pokedex-2-01.png
...
/gen/pokedex-3-51.png
```

```
sh scripts/2.2.sh /Users/amleth/repositories/sherlook-example-collection
```

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

#### `🟣 Déclaration des fichiers dérivés dans Grist`

Exécution du script [3](./scripts/3.ts).

```sh
deno scripts/3.ts --repo /Users/amleth/repositories/sherlook-example-collection
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
