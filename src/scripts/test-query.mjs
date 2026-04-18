import postgres from 'postgres';

async function test() {
  const connectionString = process.env.DATABASE_URL || '';
  const client = postgres(connectionString, { ssl: 'require' });

  try {
    console.log('📋 查询 Agent B 的会话...');
    
    const conversations = await client`
      SELECT DISTINCT c.id, c.session_id, c.metadata, c.created_at
      FROM conversations c
      WHERE c.agent_id = ${'B'}
        AND c.metadata->>'type' = 'agent-to-agent'
      ORDER BY c.created_at DESC
      LIMIT 3
    `;

    console.log(`✅ 找到 ${conversations.length} 条会话\n`);

    for (const conv of conversations) {
      console.log(`会话 ID: ${conv.id}`);
      console.log(`metadata:`, JSON.stringify(conv.metadata, null, 2));
      
      const messages = await client`
        SELECT id, role, content, metadata, created_at
        FROM messages
        WHERE conversation_id = ${conv.id}
          AND metadata->>'isCommand' = 'true'
        ORDER BY created_at ASC
        LIMIT 1
      `;

      console.log(`消息数: ${messages.length}`);
      
      if (messages.length > 0) {
        const msg = messages[0];
        console.log(`消息 ID: ${msg.id}`);
        console.log(`消息类型:`, typeof msg.content);
        console.log(`消息长度:`, msg.content ? msg.content.length : 0);
        console.log(`消息内容:`, msg.content ? `"${msg.content.substring(0, 100)}..."` : 'empty');
        console.log(`消息 metadata:`, JSON.stringify(msg.metadata));
        
        // 测试访问 content 字段
        const content = msg.content;
        console.log(`直接访问 content:`, content ? `"${content.substring(0, 100)}..."` : 'empty');
      }
      console.log('\n' + '='.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

test();
