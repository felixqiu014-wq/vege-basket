import 'dotenv/config'
import { pool, query } from './db.ts'
import { schemaSql } from './schema.ts'
import { blindIndex, decryptText, encryptJson, encryptText, isEncryptedText } from './crypto.ts'

function maybeEncrypt(value: string) {
  return isEncryptedText(value) ? value : encryptText(value)
}

async function encryptColumn(table: string, column: string) {
  const result = await query<{ id: string; value: string }>(
    `select id, ${column} as value from ${table}`,
  )
  for (const row of result.rows) {
    if (!row.value || isEncryptedText(row.value)) continue
    await query(`update ${table} set ${column} = $1 where id = $2`, [
      encryptText(row.value),
      row.id,
    ])
  }
}

async function encryptProjectPackageOperationTodoNotes() {
  const result = await query<{
    note: string
    project_package_operation_id: string
    todo_id: string
  }>(
    `
    select project_package_operation_id, todo_id, note
    from project_package_operation_todos
    `,
  )
  for (const row of result.rows) {
    if (!row.note || isEncryptedText(row.note)) continue
    await query(
      `
      update project_package_operation_todos
      set note = $1
      where project_package_operation_id = $2
        and todo_id = $3
      `,
      [
        encryptText(row.note),
        Number(row.project_package_operation_id),
        Number(row.todo_id),
      ],
    )
  }
}

async function encryptTestEnvironmentFields() {
  const result = await query<{
    id: string
    name: string
    name_lookup: string
    access_url: string
  }>(
    `select id, name, name_lookup, access_url from test_environments`,
  )

  for (const row of result.rows) {
    // Recompute the blind index from the decrypted value so legacy rows with a
    // missing or stale lookup converge to the active encryption key as well.
    const plainName = row.name ? decryptText(row.name) : ''
    await query(
      `
      update test_environments
      set name = $1,
          name_lookup = $2,
          access_url = $3
      where id = $4
      `,
      [
        maybeEncrypt(row.name),
        blindIndex(plainName),
        maybeEncrypt(row.access_url),
        Number(row.id),
      ],
    )
  }
}

async function main() {
  await query(schemaSql)

  const projects = await query<{ id: string; name: string; tags: string[]; tags_encrypted: string | null }>(
    'select id, name, tags, tags_encrypted from projects',
  )
  for (const project of projects.rows) {
    await query(
      `
      update projects
      set name = $1,
          tags_encrypted = $2,
          tags = '{}'
      where id = $3
      `,
      [
        maybeEncrypt(project.name),
        project.tags_encrypted && isEncryptedText(project.tags_encrypted)
          ? project.tags_encrypted
          : encryptJson(project.tags ?? []),
        Number(project.id),
      ],
    )
  }

  await encryptColumn('journal_entries', 'content')
  await encryptColumn('todos', 'title')
  await encryptColumn('todos', 'detail')
  await encryptColumn('risks', 'content')
  await encryptColumn('draft_items', 'content')
  await encryptColumn('draft_items', 'todo_title')
  await encryptColumn('ai_conversations', 'title')
  await encryptColumn('ai_turns', 'user_content')
  await encryptColumn('ai_turns', 'intent_payload')
  await encryptColumn('ai_turns', 'assistant_content')
  await encryptColumn('ai_turn_attachments', 'name')
  await encryptColumn('ai_turn_attachments', 'content')
  await encryptColumn('summaries', 'title')
  await encryptColumn('summaries', 'period')
  await encryptColumn('summaries', 'content')
  await encryptColumn('project_package_events', 'title')
  await encryptColumn('project_package_operations', 'title')
  await encryptColumn('project_package_operations', 'content')
  await encryptProjectPackageOperationTodoNotes()
  await encryptColumn('test_cases', 'remarks')
  await encryptTestEnvironmentFields()

  const collaborators = await query<{ id: string; name: string; role: string }>(
    'select id, name, role from collaborators',
  )
  for (const collaborator of collaborators.rows) {
    const plainName = isEncryptedText(collaborator.name) ? '' : collaborator.name
    await query(
      `
      update collaborators
      set name = $1,
          name_lookup = coalesce(name_lookup, $2),
          role = $3
      where id = $4
      `,
      [
        maybeEncrypt(collaborator.name),
        plainName ? blindIndex(plainName) : null,
        collaborator.role ? maybeEncrypt(collaborator.role) : '',
        Number(collaborator.id),
      ],
    )
  }

  const memberships = await query<{ id: string; invited_email: string; invited_email_lookup: string | null }>(
    'select id, invited_email, invited_email_lookup from project_memberships',
  )
  for (const membership of memberships.rows) {
    const plainEmail = isEncryptedText(membership.invited_email) ? '' : membership.invited_email
    await query(
      `
      update project_memberships
      set invited_email = $1,
          invited_email_lookup = coalesce(invited_email_lookup, $2)
      where id = $3
      `,
      [
        maybeEncrypt(membership.invited_email),
        plainEmail ? blindIndex(plainEmail) : membership.invited_email_lookup,
        Number(membership.id),
      ],
    )
  }

  console.log('Existing sensitive fields are encrypted.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
