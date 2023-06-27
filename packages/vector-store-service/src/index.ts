import { createLogger } from '@dingyi222666/koishi-plugin-chathub/lib/llm-core/utils/logger'
import { ChatHubPlugin } from "@dingyi222666/koishi-plugin-chathub/lib/services/chat"

import { Context, Schema } from 'koishi'
import { vectorstore } from './vectorstore'

const logger = createLogger('@dingyi222666/chathub-vectorstrore-service')

class VectorStrorePlugin extends ChatHubPlugin<VectorStrorePlugin.Config> {

    name = "@dingyi222666/chathub-vector-strore-service"

    constructor(protected ctx: Context, public readonly config: VectorStrorePlugin.Config) {
        super(ctx, config)

        setTimeout(async () => {

            await ctx.chathub.registerPlugin(this)

            await vectorstore(ctx, config, this)
        })


    }
}

namespace VectorStrorePlugin {

    export interface Config extends ChatHubPlugin.Config {
        topK: number,
        current: string,
        faissSavePath: string,

        pinecone: boolean,
        pineconeKey: string,
        pineconeRegon: string,
        pineconeIndex: string,
    }

    export const Config: Schema<Config> = Schema.intersect([
        Schema.object({
            topK: Schema.number().description('向量数据库的匹配数量').default(3).min(1).max(7),

            current: Schema.union([
                Schema.const("faiss").description("Faiss 本地向量数据库"),
                Schema.const("pinecone").description("Pinecone 云向量数据库"),
            ]).default("faiss").description('当前使用的向量数据库'),
        }).description('向量数据库设置'),

        Schema.union([
            Schema.object({
                current: Schema.const("faiss").required(),
                faissSavePath: Schema.string().description('faiss 向量数据库保存路径').default("data/chathub/vectorstrore/faiss"),
            }).description("Faiss 设置"),
            Schema.object({
                current: Schema.const("pinecone").required(),
                pineconeKey: Schema.string().role("secret").description('Pinecone 的 API Key').required(),
                pineconeRegon: Schema.string().description('Pinecone 的地区').required(),
                pineconeIndex: Schema.string().description('Pinecone 的索引名称').required(),
            }),
            Schema.object({}),
        ]),


    ]) as Schema<Config>

    export const using = ['chathub']

    export const usage = `
    ## 提示
    在新版本中我们不再直接依赖向量数据库的相关库，你需要自己安装相关依赖到 koishi 根目录下。

    要查看如何配置 faiss 数据库，看[这里](https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/faiss#setup)

    要查看如何配置 pinecone 数据库，看[这里](https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/pinecone#setup)

    目前配置 faiss 数据库安装后可能会导致 koishi 环境不安全，如果安装完成后进行某些操作完成后出现了问题（如，升级 node 版本），开发者不对此负直接责任。
    `   
}

export const usage = `
## 提示
在新版本中我们不再直接依赖向量数据库的相关库，你需要自己安装相关依赖到 koishi 根目录下。

要查看如何配置 faiss 数据库，看[这里](https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/faiss#setup)

要查看如何配置 pinecone 数据库，看[这里](https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/pinecone#setup)

目前配置 faiss 数据库安装后可能会导致 koishi 环境不安全，如果安装完成后进行某些操作完成后出现了问题（如，升级 node 版本），开发者不对此负直接责任。
`   

export default VectorStrorePlugin