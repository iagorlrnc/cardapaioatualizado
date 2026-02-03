# Validação de Senha - Implementação com Zod

## Resumo das Alterações

A validação de senha foi implementada utilizando a biblioteca **Zod** para garantir senhas fortes em toda a aplicação.

## Requisitos de Senha

Todas as senhas agora devem atender aos seguintes critérios:

- ✅ **Mínimo 8 caracteres**
- ✅ **Pelo menos 1 letra maiúscula** (A-Z)
- ✅ **Pelo menos 1 caractere especial** (!@#$%^&\*()\_+-=[]{}';:"\\|,.<>/?/)

## Arquivos Modificados

### 1. **src/lib/validationSchemas.ts** (NOVO)

Arquivo criado para centralizar as validações com Zod:

- `passwordSchema`: Validação de senha forte
- `adminRegistrationSchema`: Validação completa para cadastro de admin/funcionário
- `loginSchema`: Validação simples para login

### 2. **src/pages/AdminLogin.tsx**

**Mudanças:**

- Importado `adminRegistrationSchema` e `passwordSchema` do arquivo de schemas
- Função `handleRegisterSubmit()` agora usa validação com Zod
- Validação ocorre antes de verificar o banco de dados
- Mensagens de erro mais precisas baseadas em qual critério falhou
- Adicionado texto de ajuda embaixo do campo de senha

**Exemplo de validação:**

```typescript
const validationResult = adminRegistrationSchema.safeParse({
  username: regUsername,
  phone: regPhone,
  password: regPassword,
  confirmPassword: regConfirmPassword,
  userType: userType,
});
```

### 3. **src/pages/AdminDashboard.tsx**

**Mudanças:**

- Importado `passwordSchema` do arquivo de schemas
- Função `handleSaveUser()` agora valida a senha com Zod
- Validação ocorre antes de salvar no banco de dados
- Adicionado texto de ajuda embaixo do campo de senha

**Exemplo de validação:**

```typescript
const passwordValidation = passwordSchema.safeParse(userFormData.password);
if (!passwordValidation.success) {
  const errorMessage = passwordValidation.error.errors[0].message;
  toast.error(errorMessage);
  return;
}
```

## Como a Validação Funciona

### No Cadastro de Admin/Funcionário (AdminLogin.tsx)

1. Usuário preenche o formulário
2. Ao clicar em "Solicitar ao Administrador", a função `handleRegisterSubmit()` é acionada
3. O Zod valida todos os campos (username, phone, password, confirmPassword, userType)
4. Se falhar em qualquer critério, uma mensagem de erro é exibida
5. Se passar, a senha é hasheada com bcrypt e enviada ao banco

### Na Criação de Usuário pelo Admin (AdminDashboard.tsx)

1. Admin preenche os dados do novo usuário
2. Ao clicar em "Adicionar Usuário", a função `handleSaveUser()` é acionada
3. O Zod valida a senha
4. Se falhar, um toast com a mensagem de erro é exibido
5. Se passar, o usuário é criado com status "approved"

## Mensagens de Erro

As mensagens de erro retornadas são:

- **Comprimento insuficiente:** "A senha deve ter no mínimo 8 caracteres"
- **Falta letra maiúscula:** "A senha deve conter pelo menos uma letra maiúscula"
- **Falta caractere especial:** "A senha deve conter pelo menos um caractere especial (!@#$%^&\* etc.)"
- **Senhas não coincidem:** "As senhas não coincidem"

## Exemplos de Senhas Válidas

- `Exemplo@123` ✅
- `Minha.Senha2` ✅
- `Força#Máxima1` ✅
- `P@ssw0rd` ✅

## Exemplos de Senhas Inválidas

- `senha123` ❌ (sem maiúscula, sem caractere especial)
- `Senha123` ❌ (sem caractere especial)
- `Senha@` ❌ (menos de 8 caracteres)
- `SENHA@123` ✅ (válida apesar de todas maiúsculas)

## Instalação da Dependência

A biblioteca Zod foi instalada automaticamente:

```bash
npm install zod
```

## Benefícios da Implementação

✅ **Segurança aprimorada** - Senhas fortes são obrigatórias  
✅ **Validação centralizada** - Reutilizável em múltiplos lugares  
✅ **Feedback claro** - Usuários sabem exatamente o que fazer  
✅ **Tipo-seguro** - TypeScript com Zod oferece segurança em tempo de compilação  
✅ **Consistência** - Mesmas regras em todos os formulários
