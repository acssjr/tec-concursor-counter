document.addEventListener('DOMContentLoaded', function() {
    // Elementos do formulário
    const form = document.getElementById('question-form');
    const materiaInput = document.getElementById('materia');
    const cadernoInput = document.getElementById('caderno');
    const acertosInput = document.getElementById('acertos');
    const errosInput = document.getElementById('erros');
    const totalDisplay = document.getElementById('total-questions');
    
    // Elementos da tabela
    const sessionsTable = document.getElementById('sessions-table');
    const sessionsBody = document.getElementById('sessions-body');
    const noSessionsMessage = document.getElementById('no-sessions');
    
    // Elementos do filtro
    const filterMateria = document.getElementById('filter-materia');
    const clearFiltersBtn = document.getElementById('clear-filters');
    
    // Elementos do resumo
    const summaryTotal = document.getElementById('summary-total');
    const summaryAcertos = document.getElementById('summary-acertos');
    const summaryErros = document.getElementById('summary-erros');
    const summaryTaxa = document.getElementById('summary-taxa');
    
    // Atualiza o total de questões em tempo real
    acertosInput.addEventListener('input', updateTotal);
    errosInput.addEventListener('input', updateTotal);
    
    function updateTotal() {
        const acertos = parseInt(acertosInput.value) || 0;
        const erros = parseInt(errosInput.value) || 0;
        totalDisplay.textContent = acertos + erros;
    }
    
    // Carregar sessões ao iniciar
    loadSessions();
    
    // Enviar formulário
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const acertos = parseInt(acertosInput.value) || 0;
        const erros = parseInt(errosInput.value) || 0;
        
        const session = {
            materia: materiaInput.value.trim(),
            caderno: cadernoInput.value.trim(),
            acertos: acertos,
            erros: erros
        };
        
        saveSession(session);
    });
    
    // Filtrar por matéria
    filterMateria.addEventListener('change', function() {
        loadSessions();
    });
    
    // Limpar filtros
    clearFiltersBtn.addEventListener('click', function() {
        filterMateria.value = '';
        loadSessions();
    });
    
    // Funções para interagir com a API
    function loadSessions() {
        fetch('/api/sessions')
            .then(response => response.json())
            .then(data => {
                displaySessions(data.sessions);
                updateFilterOptions(data.sessions);
                updateSummary(data.sessions);
            })
            .catch(error => console.error('Erro ao carregar sessões:', error));
    }
    
    function saveSession(session) {
        fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(session)
        })
        .then(response => response.json())
        .then(data => {
            // Limpar formulário
            form.reset();
            totalDisplay.textContent = '0';
            
            // Recarregar sessões
            loadSessions();
        })
        .catch(error => console.error('Erro ao salvar sessão:', error));
    }
    
    function deleteSession(index) {
        if (confirm('Tem certeza que deseja excluir esta sessão?')) {
            fetch(`/api/sessions/${index}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                loadSessions();
            })
            .catch(error => console.error('Erro ao excluir sessão:', error));
        }
    }
    
    // Funções para atualizar a interface
    function displaySessions(sessions) {
        sessionsBody.innerHTML = '';
        
        const filterValue = filterMateria.value.toLowerCase();
        
        // Filtrar sessões se necessário
        let filteredSessions = sessions;
        if (filterValue) {
            filteredSessions = sessions.filter(s => 
                s.materia.toLowerCase().includes(filterValue));
        }
        
        if (filteredSessions.length === 0) {
            sessionsTable.classList.add('hidden');
            noSessionsMessage.classList.remove('hidden');
        } else {
            sessionsTable.classList.remove('hidden');
            noSessionsMessage.classList.add('hidden');
            
            filteredSessions.forEach((session, index) => {
                const row = document.createElement('tr');
                
                // Formatar data
                const date = new Date(session.date);
                const formattedDate = date.toLocaleDateString('pt-BR') + ' ' + 
                                    date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${session.materia}</td>
                    <td>${session.caderno || '-'}</td>
                    <td>${session.acertos}</td>
                    <td>${session.erros}</td>
                    <td>${session.total}</td>
                    <td>
                        <button class="action-btn" data-index="${index}">Excluir</button>
                    </td>
                `;
                
                sessionsBody.appendChild(row);
            });
            
            // Adicionar eventos aos botões de excluir
            document.querySelectorAll('.action-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = this.getAttribute('data-index');
                    deleteSession(index);
                });
            });
        }
    }
    
    function updateFilterOptions(sessions) {
        // Limpar opções existentes exceto a primeira
        while (filterMateria.options.length > 1) {
            filterMateria.remove(1);
        }
        
        // Obter matérias únicas
        const materias = [...new Set(sessions.map(s => s.materia))];
        
        // Adicionar opções
        materias.forEach(materia => {
            const option = document.createElement('option');
            option.value = materia;
            option.textContent = materia;
            filterMateria.appendChild(option);
        });
    }
    
    function updateSummary(sessions) {
        const filterValue = filterMateria.value.toLowerCase();
        
        // Filtrar sessões se necessário
        let filteredSessions = sessions;
        if (filterValue) {
            filteredSessions = sessions.filter(s => 
                s.materia.toLowerCase().includes(filterValue));
        }
        
        // Calcular totais
        const totalAcertos = filteredSessions.reduce((sum, s) => sum + s.acertos, 0);
        const totalErros = filteredSessions.reduce((sum, s) => sum + s.erros, 0);
        const totalQuestoes = totalAcertos + totalErros;
        
        // Taxa de acerto
        let taxaAcerto = 0;
        if (totalQuestoes > 0) {
            taxaAcerto = (totalAcertos / totalQuestoes * 100).toFixed(1);
        }
        
        // Atualizar resumo
        summaryTotal.textContent = totalQuestoes;
        summaryAcertos.textContent = totalAcertos;
        summaryErros.textContent = totalErros;
        summaryTaxa.textContent = taxaAcerto + '%';
    }
});
