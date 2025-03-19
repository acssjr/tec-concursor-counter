# QuestPro - Rastreador de Progresso para Questões de Concursos

QuestPro é uma aplicação web para o controle e análise estatística de questões respondidas durante o estudo para concursos públicos. Integra-se com o site TEC Concursos para automatizar o processo de contabilização de acertos e erros.

## Funcionalidades

- **Dashboard em tempo real**: Visualize acertos, erros e total de questões
- **Integração com TEC Concursos**: Contabilização automática através de userscript
- **Botão de desfazer**: Corrigir registros feitos por engano
- **Histórico detalhado**: Acompanhe suas últimas atividades
- **Estatísticas por matéria**: Análise de performance por disciplina
- **Sessões de estudo**: Salve sessões com matéria e caderno
- **Taxa de acerto**: Análise percentual do desempenho

## Requisitos

- Python 3.6+
- Flask
- Navegador com suporte a userscripts (Chrome, Firefox, Edge)
- Tampermonkey ou extensão similar para instalação do userscript

## Instalação

1. Clone este repositório:
   ```
   git clone https://github.com/seu-usuario/questpro.git
   cd questpro
   ```

2. Instale as dependências:
   ```
   pip install -r requirements.txt
   ```

3. Execute o servidor Flask:
   ```
   python app.py
   ```

4. Instale o userscript:
   - Abra o Tampermonkey em seu navegador
   - Crie um novo script
   - Copie e cole o conteúdo do arquivo `tec_concursos_counter.user.js`
   - Salve o script

## Uso

1. Inicie o servidor Flask:
   ```
   python app.py
   ```

2. Abra o aplicativo em seu navegador:
   ```
   http://localhost:5000
   ```

3. Para integração com o TEC Concursos:
   - Instale o userscript conforme instruções acima
   - Acesse o site do TEC Concursos
   - O painel flutuante aparecerá na tela
   - Use os botões "✓ Acerto" ou "✗ Erro" para registrar suas respostas
   - Use o botão "↩ Desfazer" se precisar corrigir um registro

4. Para salvar uma sessão de estudo:
   - Preencha a matéria e (opcionalmente) o nome do caderno
   - Clique em "Salvar Esta Sessão"

## Estrutura do Projeto

- `app.py`: Servidor Flask com API e rotas
- `templates/index.html`: Interface web principal
- `tec_concursos_counter.user.js`: Userscript para integração
- `sessions.json`: Armazenamento local de sessões

## Tecnologias

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript puro
- **Armazenamento**: JSON local
- **Integração**: Userscript (Tampermonkey)

## Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.
