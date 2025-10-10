# Manual do Usuário - Sistema de Barbearia

## Índice
1. [Introdução](#introdução)
2. [Login e Autenticação](#login-e-autenticação)
3. [Funcionalidades para Administradores](#funcionalidades-para-administradores)
4. [Funcionalidades para Barbeiros](#funcionalidades-para-barbeiros)
5. [Funcionalidades Compartilhadas](#funcionalidades-compartilhadas)
6. [Dicas e Boas Práticas](#dicas-e-boas-práticas)

---

## Introdução

Este sistema foi desenvolvido para gerenciar todas as operações de uma barbearia, incluindo agendamentos, vendas, relatórios financeiros e controle de estoque. O sistema possui dois tipos de usuários: **Administradores** e **Barbeiros**, cada um com permissões específicas.

### Tipos de Usuário:
- **Admin**: Acesso completo ao sistema, incluindo relatórios financeiros, gestão de produtos, serviços e despesas
- **Barbeiro**: Acesso aos próprios agendamentos, comissões e funcionalidades de vendas

---

## Login e Autenticação

### Como fazer login:
1. Acesse a página inicial do sistema
2. Digite seu **email** e **senha** nos campos correspondentes
3. Clique em **"Entrar"**
4. O sistema redirecionará você para o dashboard apropriado baseado no seu tipo de usuário

### Recuperação de senha:
- Entre em contato com o administrador do sistema para redefinir sua senha

---

## Funcionalidades para Administradores

### 1. Dashboard Administrativo
- **Visão geral**: Métricas principais do negócio
- **Receita total**: Faturamento do período
- **Agendamentos**: Total de agendamentos e status
- **Vendas**: Produtos vendidos e ticket médio
- **Clientes ativos**: Número de clientes que utilizaram os serviços

### 2. Gestão de Agendamentos

#### Visualização do Calendário:
- **Vista Mensal**: Visão geral dos agendamentos do mês
- **Vista Diária**: Detalhes dos agendamentos por dia
- **Vista Desktop**: Interface otimizada para computadores

#### Criando um Agendamento:
1. Clique no botão **"Novo Agendamento"** ou clique em um horário vazio no calendário
2. Preencha os dados:
   - **Cliente**: Selecione um cliente existente ou crie um novo
   - **Barbeiro**: Escolha o barbeiro responsável
   - **Data e Hora**: Defina quando será o atendimento
   - **Serviços**: Selecione os serviços a serem realizados
   - **Recorrência**: Configure se o agendamento se repetirá
3. Clique em **"Salvar"**

#### Gerenciando Agendamentos:
- **Editar**: Clique no agendamento e selecione "Editar"
- **Alterar Status**: Marque como confirmado, em andamento ou concluído
- **Concluir com Pagamento**: Finalize o atendimento e registre o pagamento
- **Excluir**: Remove o agendamento (requer confirmação)

#### Bloqueios de Horário:
- **Criar Bloco**: Clique em um horário e selecione "Criar Bloco"
- **Excluir Bloco**: Clique no bloco (vermelho) e confirme a exclusão
- **Uso**: Utilize para marcar horários indisponíveis (almoço, folgas, etc.)

### 3. Gestão de Clientes

#### Visualizando Clientes:
- Lista completa de todos os clientes cadastrados
- Busca por nome ou telefone
- Histórico de agendamentos de cada cliente

#### Cadastrando Novo Cliente:
1. Clique em **"Novo Cliente"**
2. Preencha os dados obrigatórios:
   - **Nome completo**
   - **Telefone**
   - **Email** (opcional)
   - **Data de nascimento** (opcional)
3. Clique em **"Salvar"**

#### Editando Cliente:
1. Clique no cliente desejado
2. Altere as informações necessárias
3. Clique em **"Salvar Alterações"**

### 4. Sistema de Vendas (PDV)

#### Realizando uma Venda:
1. Acesse a seção **"Vendas"**
2. Adicione produtos ao carrinho:
   - Clique no botão **"+"** ao lado do produto desejado
   - Ajuste a quantidade conforme necessário
3. Selecione o cliente (opcional para venda avulsa)
4. Clique em **"Finalizar Venda"**
5. Escolha a forma de pagamento:
   - **Dinheiro**
   - **Cartão de Débito**
   - **Cartão de Crédito**
   - **PIX**
6. Confirme a venda

#### Gerenciando o Carrinho:
- **Aumentar quantidade**: Clique no botão **"+"**
- **Diminuir quantidade**: Clique no botão **"-"**
- **Remover item**: Clique no **"×"**
- **Limpar carrinho**: Remova todos os itens

### 5. Gestão de Produtos

#### Cadastrando Produtos:
1. Acesse **"Produtos"**
2. Clique em **"Novo Produto"**
3. Preencha as informações:
   - **Nome do produto**
   - **Preço de venda**
   - **Quantidade em estoque**
   - **Categoria** (opcional)
4. Clique em **"Salvar"**

#### Controlando Estoque:
- **Alerta de estoque baixo**: Produtos com menos de 5 unidades aparecem com aviso
- **Atualização de estoque**: Edite o produto para ajustar quantidades
- **Produtos esgotados**: Não podem ser adicionados ao carrinho

### 6. Gestão de Serviços

#### Cadastrando Serviços:
1. Acesse **"Serviços"**
2. Clique em **"Novo Serviço"**
3. Defina:
   - **Nome do serviço**
   - **Preço**
   - **Duração** (em minutos)
   - **Comissão do barbeiro** (percentual)
4. Clique em **"Salvar"**

#### Editando Serviços:
- Altere preços, duração ou comissões conforme necessário
- Serviços podem ser desativados sem excluir o histórico

### 7. Controle de Despesas

#### Registrando Despesas:
1. Acesse **"Despesas"**
2. Clique em **"Nova Despesa"**
3. Preencha:
   - **Descrição** da despesa
   - **Valor**
   - **Categoria** (Aluguel, Energia, Produtos, etc.)
   - **Data** da despesa
   - **Observações** (opcional)
4. Clique em **"Salvar"**

#### Categorias de Despesas:
- Aluguel
- Energia Elétrica
- Água
- Internet
- Produtos de Limpeza
- Material de Trabalho
- Marketing
- Equipamentos
- Manutenção
- Outros

### 8. Relatórios Administrativos

#### Acessando Relatórios:
1. Acesse **"Relatórios"**
2. Insira a senha administrativa quando solicitado
3. Selecione o período desejado (hoje, semana, mês, ano)

#### Tipos de Relatórios:
- **Financeiro**: Receita, despesas, lucro líquido
- **Agendamentos**: Performance por barbeiro
- **Vendas**: Produtos mais vendidos, ticket médio
- **Comissões**: Detalhamento por barbeiro
- **Clientes**: Análise de frequência e fidelidade

#### Análises Disponíveis:
- **Receita por dia**: Gráfico de faturamento diário
- **Despesas por categoria**: Distribuição dos gastos
- **Performance dos barbeiros**: Ranking de produtividade
- **Produtos mais vendidos**: Top 10 produtos
- **Margem de lucro**: Percentual de lucratividade

---

## Funcionalidades para Barbeiros

### 1. Dashboard do Barbeiro
- **Próximos agendamentos**: Lista dos atendimentos do dia
- **Comissões do mês**: Valor acumulado de comissões
- **Agendamentos da semana**: Visão semanal da agenda

### 2. Meus Agendamentos

#### Visualizando Agenda:
- **Calendário pessoal**: Apenas seus agendamentos
- **Filtros por status**: Pendente, confirmado, concluído
- **Vista diária**: Detalhes dos horários do dia

#### Gerenciando Agendamentos:
- **Alterar status**: Confirmar ou marcar como em andamento
- **Concluir atendimento**: Finalizar com registro de pagamento
- **Adicionar observações**: Notas sobre o atendimento

### 3. Minhas Comissões

#### Visualizando Comissões:
1. Acesse **"Minhas Comissões"**
2. Selecione o período desejado
3. Visualize:
   - **Total de comissões** do período
   - **Comissões por serviços** realizados
   - **Comissões por produtos** vendidos
   - **Gráfico de evolução** diária

#### Detalhamento:
- **Por serviço**: Lista de todos os serviços realizados e suas comissões
- **Por produto**: Vendas realizadas e comissões correspondentes
- **Por cliente**: Histórico de atendimentos por cliente
- **Formas de pagamento**: Distribuição por método de pagamento

### 4. Sistema de Vendas

#### Como Vender Produtos:
1. Acesse **"Vendas"** (mesmo processo do admin)
2. Adicione produtos ao carrinho
3. Selecione o cliente
4. Finalize a venda
5. **Importante**: As comissões das vendas serão creditadas automaticamente

---

## Funcionalidades Compartilhadas

### 1. Gestão de Clientes
- Ambos os perfis podem visualizar e cadastrar clientes
- Histórico completo de atendimentos
- Busca por nome ou telefone

### 2. Sistema de Vendas
- Interface idêntica para admin e barbeiro
- Comissões calculadas automaticamente
- Controle de estoque em tempo real

### 3. Calendário de Agendamentos
- Visualização dos agendamentos
- Criação de novos agendamentos
- Alteração de status

---

## Dicas e Boas Práticas

### Para Administradores:

#### Gestão Financeira:
- **Registre todas as despesas** imediatamente para manter relatórios precisos
- **Monitore as comissões** regularmente para controlar custos
- **Analise os relatórios semanalmente** para identificar tendências
- **Mantenha o estoque atualizado** para evitar vendas perdidas

#### Gestão de Agendamentos:
- **Use blocos** para marcar horários de almoço e pausas
- **Confirme agendamentos** por telefone ou WhatsApp
- **Monitore no-shows** e crie políticas de cancelamento
- **Distribua agendamentos** equilibradamente entre barbeiros

#### Gestão de Produtos:
- **Configure alertas** para produtos com estoque baixo
- **Revise preços** periodicamente baseado nos relatórios
- **Analise produtos mais vendidos** para otimizar estoque
- **Cadastre novos produtos** com informações completas

### Para Barbeiros:

#### Maximizando Comissões:
- **Sugira produtos complementares** durante o atendimento
- **Mantenha qualidade** nos serviços para fidelizar clientes
- **Pontualidade** é essencial para manter a agenda organizada
- **Acompanhe suas métricas** através dos relatórios de comissão

#### Atendimento ao Cliente:
- **Confirme agendamentos** antecipadamente
- **Mantenha informações atualizadas** dos clientes
- **Registre observações importantes** sobre preferências
- **Finalize atendimentos** corretamente no sistema

### Gerais:

#### Segurança:
- **Não compartilhe senhas** com outros usuários
- **Faça logout** ao sair do sistema
- **Mantenha dados dos clientes** confidenciais
- **Reporte problemas** técnicos imediatamente

#### Eficiência:
- **Use atalhos** do teclado quando disponíveis
- **Mantenha navegador atualizado** para melhor performance
- **Feche abas desnecessárias** para economizar memória
- **Faça backup** regular dos dados importantes

#### Suporte:
- **Documente problemas** com detalhes para facilitar suporte
- **Teste funcionalidades** em horários de menor movimento
- **Sugira melhorias** baseadas na experiência de uso
- **Participe de treinamentos** quando oferecidos

---

## Solução de Problemas Comuns

### Problemas de Login:
- Verifique se o email está correto
- Confirme se a senha está correta (sensível a maiúsculas/minúsculas)
- Limpe o cache do navegador
- Tente usar outro navegador

### Problemas de Performance:
- Feche outras abas do navegador
- Verifique a conexão com a internet
- Atualize a página (F5)
- Reinicie o navegador

### Problemas com Agendamentos:
- Verifique se o horário não está ocupado
- Confirme se o barbeiro está disponível
- Verifique se a data não é passada
- Certifique-se de que todos os campos obrigatórios estão preenchidos

### Problemas com Vendas:
- Verifique se há estoque suficiente
- Confirme se o produto está ativo
- Verifique a conexão com a internet
- Tente recarregar a página de vendas

---

**Versão do Manual**: 1.0  
**Última Atualização**: Janeiro 2025  
**Suporte Técnico**: Entre em contato com o administrador do sistema