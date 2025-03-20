from flask import Flask, render_template, request, jsonify, redirect, url_for
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)

# Habilitar CORS para todas as rotas
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Origin, Accept'
    return response

# Tratar requisições OPTIONS para CORS preflight
@app.route('/api/increment', methods=['OPTIONS'])
@app.route('/api/undo', methods=['OPTIONS'])
@app.route('/api/status', methods=['OPTIONS'])
@app.route('/api/reset', methods=['OPTIONS'])
@app.route('/api/stats', methods=['OPTIONS'])
def handle_options():
    return '', 204

# Caminho para o arquivo de dados
DATA_FILE = 'sessions.json'

# Verificar se o arquivo de dados existe, senão criar
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({"sessions": [], "history": []}, f)

# Variáveis globais para contadores temporários (usados pela API)
contador_acertos = 0
contador_erros = 0
historico_operacoes = []  # Lista para armazenar o histórico de operações

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            try:
                data = json.load(f)
                # Verificar formato adequado
                if isinstance(data, dict) and "sessions" in data:
                    return data["sessions"]
                elif isinstance(data, list):
                    return data
                else:
                    return []
            except json.JSONDecodeError:
                return []
    return []

def save_data(sessions_list):
    # Salvar no formato esperado
    data = {"sessions": sessions_list, "history": historico_operacoes}
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Função para obter o datetime atual no horário de Brasília (GMT-3)
def datetime_brasil():
    # Retorna o datetime atual com o ajuste para GMT-3 (Brasília)
    return datetime.now() - timedelta(hours=3)

@app.route('/')
def index():
    # Carregar sessões do arquivo
    sessions = load_data()
    
    # Certificar-se de que os itens são dicionários e adicionar total
    sessions_processed = []
    for item in sessions:
        if isinstance(item, dict):
            # Se for um dicionário, processar normalmente
            total = item.get('acertos', 0) + item.get('erros', 0)
            item['total'] = total
            # Calcular taxa de acerto
            if total > 0:
                item['taxa_acerto'] = round((item.get('acertos', 0) / total) * 100, 1)
            else:
                item['taxa_acerto'] = 0
            sessions_processed.append(item)
    
    # Agrupar dados por matéria para estatísticas
    stats_por_materia = {}
    for session in sessions_processed:
        materia = session.get('materia')
        if materia not in stats_por_materia:
            stats_por_materia[materia] = {
                'acertos': 0,
                'erros': 0,
                'total': 0
            }
        stats_por_materia[materia]['acertos'] += session.get('acertos', 0)
        stats_por_materia[materia]['erros'] += session.get('erros', 0)
        stats_por_materia[materia]['total'] += session.get('total', 0)
    
    # Calcular taxa de acerto por matéria
    for materia in stats_por_materia:
        total = stats_por_materia[materia]['total']
        if total > 0:
            stats_por_materia[materia]['taxa_acerto'] = round(
                (stats_por_materia[materia]['acertos'] / total) * 100, 1
            )
        else:
            stats_por_materia[materia]['taxa_acerto'] = 0
    
    # Obter o ano atual para o footer
    ano_atual = datetime_brasil().year
    
    return render_template('index.html', 
                          sessions=sessions_processed, 
                          stats_por_materia=stats_por_materia,
                          historico=historico_operacoes[-10:],  # Enviar últimas 10 operações
                          ano_atual=ano_atual)

@app.route('/add', methods=['POST'])
def add_session():
    materia = request.form.get('materia', '')
    caderno = request.form.get('caderno', '')
    acertos = int(request.form.get('acertos', 0))
    erros = int(request.form.get('erros', 0))
    
    # Criar nova sessão
    session = {
        'date': datetime_brasil().strftime('%d/%m/%Y %H:%M'),
        'materia': materia,
        'caderno': caderno,
        'acertos': acertos,
        'erros': erros,
        'total': acertos + erros,  # Pré-calcular o total
        'taxa_acerto': round((acertos / (acertos + erros)) * 100, 1) if (acertos + erros) > 0 else 0
    }
    
    # Carregar sessões existentes
    sessions = load_data()
    
    # Adicionar nova sessão
    sessions.append(session)
    
    # Resetar contadores após salvar
    global contador_acertos, contador_erros
    contador_acertos = 0
    contador_erros = 0
    
    # Limpar histórico de operações após salvar
    global historico_operacoes
    historico_operacoes = []
    
    # Salvar de volta no arquivo
    save_data(sessions)
    
    return redirect(url_for('index'))

@app.route('/delete/<int:index>')
def delete_session(index):
    # Carregar sessões
    sessions = load_data()
    
    # Remover a sessão no índice especificado, se existir
    if 0 <= index < len(sessions):
        sessions.pop(index)
        
        # Salvar de volta no arquivo
        save_data(sessions)
    
    return redirect(url_for('index'))

# Nova rota para API que o userscript usará
@app.route('/api/increment', methods=['POST', 'OPTIONS'])
def increment_counter():
    global contador_acertos, contador_erros, historico_operacoes
    
    # Obter dados do request
    data = request.get_json()
    
    if not data or 'type' not in data:
        return jsonify({'error': 'Dados inválidos'}), 400
    
    # Extrair informações detalhadas da questão
    question_info = data.get('question_info', {})
    if not question_info:
        return jsonify({'error': 'Informações da questão não fornecidas'}), 400
    
    # Enriquecer o objeto question_info com timestamp
    question_info['timestamp'] = datetime_brasil().strftime('%d/%m/%Y %H:%M:%S')
    
    # Incrementar o contador apropriado
    if data['type'] == 'acerto':
        contador_acertos += 1
        # Adicionar ao histórico
        historico_operacoes.append({
            'tipo': 'acerto',
            'timestamp': datetime_brasil().strftime('%d/%m/%Y %H:%M:%S'),
            'questao': question_info
        })
        return jsonify({
            'success': True,
            'message': 'Acerto contabilizado',
            'acertos': contador_acertos,
            'erros': contador_erros,
            'total': contador_acertos + contador_erros,
            'operation_id': len(historico_operacoes) - 1  # ID da operação para possível desfazer
        })
    elif data['type'] == 'erro':
        contador_erros += 1
        # Adicionar ao histórico
        historico_operacoes.append({
            'tipo': 'erro',
            'timestamp': datetime_brasil().strftime('%d/%m/%Y %H:%M:%S'),
            'questao': question_info
        })
        return jsonify({
            'success': True,
            'message': 'Erro contabilizado',
            'acertos': contador_acertos,
            'erros': contador_erros,
            'total': contador_acertos + contador_erros,
            'operation_id': len(historico_operacoes) - 1  # ID da operação para possível desfazer
        })
    else:
        return jsonify({'error': 'Tipo inválido'}), 400

# Rota para obter o estado atual dos contadores
@app.route('/api/status', methods=['GET'])
def get_counter_status():
    global contador_acertos, contador_erros, historico_operacoes
    
    return jsonify({
        'acertos': contador_acertos,
        'erros': contador_erros,
        'total': contador_acertos + contador_erros,
        'historico': historico_operacoes[-10:]  # Retorna as últimas 10 operações
    })

# Rota para zerar os contadores via API
@app.route('/api/reset', methods=['POST'])
def reset_counters():
    global contador_acertos, contador_erros, historico_operacoes
    
    contador_acertos = 0
    contador_erros = 0
    historico_operacoes = []
    
    return jsonify({
        'success': True,
        'message': 'Contadores zerados',
        'acertos': contador_acertos,
        'erros': contador_erros,
        'total': 0
    })

# Nova rota para desfazer última operação
@app.route('/api/undo', methods=['POST'])
def undo_operation():
    global contador_acertos, contador_erros, historico_operacoes
    
    # Verificar se há operações para desfazer
    if not historico_operacoes:
        return jsonify({
            'success': False,
            'message': 'Não há operações para desfazer',
            'acertos': contador_acertos,
            'erros': contador_erros,
            'total': contador_acertos + contador_erros
        })
    
    # Pegar a última operação
    ultima_operacao = historico_operacoes.pop()
    tipo_operacao = ultima_operacao.get('tipo')
    
    # Decrementar o contador apropriado
    if tipo_operacao == 'acerto' and contador_acertos > 0:
        contador_acertos -= 1
    elif tipo_operacao == 'erro' and contador_erros > 0:
        contador_erros -= 1
    
    return jsonify({
        'success': True,
        'message': f'Última operação ({tipo_operacao}) desfeita',
        'acertos': contador_acertos,
        'erros': contador_erros,
        'total': contador_acertos + contador_erros,
        'operacao_desfeita': ultima_operacao
    })

# Nova rota para obter estatísticas detalhadas
@app.route('/api/stats', methods=['GET'])
def get_detailed_stats():
    # Carregar todo o histórico de operações
    try:
        with open(DATA_FILE, 'r') as f:
            data = json.load(f)
            historico = data.get('history', [])
    except (json.JSONDecodeError, FileNotFoundError):
        historico = []
    
    # Inicializar estatísticas
    stats = {
        'por_materia': {},
        'por_assunto': {},
        'por_banca': {},
        'por_ano': {}
    }
    
    # Processar o histórico para gerar estatísticas
    for op in historico:
        # Extrair informações da questão
        questao = op.get('questao', {})
        tipo = op.get('tipo', '')  # acerto ou erro
        
        # Extrair campos relevantes
        materia = questao.get('subject', 'Não especificada')
        assunto = questao.get('topic', 'Não especificado')
        banca = questao.get('examBoard', 'Não especificada')
        ano = questao.get('year', 'Não especificado')
        
        # Estatísticas por matéria
        if materia not in stats['por_materia']:
            stats['por_materia'][materia] = {'acertos': 0, 'erros': 0, 'total': 0}
        stats['por_materia'][materia][tipo + 's'] += 1
        stats['por_materia'][materia]['total'] += 1
        
        # Estatísticas por assunto
        if assunto not in stats['por_assunto']:
            stats['por_assunto'][assunto] = {'acertos': 0, 'erros': 0, 'total': 0}
        stats['por_assunto'][assunto][tipo + 's'] += 1
        stats['por_assunto'][assunto]['total'] += 1
        
        # Estatísticas por banca
        if banca not in stats['por_banca']:
            stats['por_banca'][banca] = {'acertos': 0, 'erros': 0, 'total': 0}
        stats['por_banca'][banca][tipo + 's'] += 1
        stats['por_banca'][banca]['total'] += 1
        
        # Estatísticas por ano
        if ano not in stats['por_ano']:
            stats['por_ano'][ano] = {'acertos': 0, 'erros': 0, 'total': 0}
        stats['por_ano'][ano][tipo + 's'] += 1
        stats['por_ano'][ano]['total'] += 1
    
    # Calcular taxas de acerto
    for categoria in stats:
        for item in stats[categoria]:
            total = stats[categoria][item]['total']
            acertos = stats[categoria][item]['acertos']
            if total > 0:
                stats[categoria][item]['taxa_acerto'] = round((acertos / total) * 100, 1)
            else:
                stats[categoria][item]['taxa_acerto'] = 0
    
    return jsonify({
        'success': True,
        'stats': stats,
        'total_registros': len(historico)
    })

if __name__ == '__main__':
    app.run(debug=True)
