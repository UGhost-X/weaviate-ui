import os
import uuid
from typing import Dict, Any, Optional, List
import weaviate
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from loguru import logger
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEAVIATE_API_KEYS = os.getenv("WEAVIATE_API_KEYS", None)
client = weaviate.Client(
    url=os.getenv("WEAVIATE_URL"),
    auth_client_secret=weaviate.AuthApiKey(api_key=WEAVIATE_API_KEYS) if WEAVIATE_API_KEYS else None,
)

# Pydantic 模型定义
class ObjectCreate(BaseModel):
    properties: Dict[str, Any]
    vector: Optional[List[float]] = None

class ObjectUpdate(BaseModel):
    properties: Dict[str, Any]
    vector: Optional[List[float]] = None

class ObjectResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

# 获取 schema
@app.get("/schema")
def schema():
    return client.schema.get()

# 查询数据（原有功能）
@app.get("/class/{class_name}/{offset}/{limit}/{keyword}")
def query_objects(class_name: str, offset: int, limit: int, keyword: str = '', properties: list[str] = Query(None), sort: str = 'none'):
    try:
        builder = client.query.get(class_name, properties)
        logger.info(f"Querying class: {class_name}, keyword: {keyword}")
        
        if keyword != "none":
            builder = builder.with_near_text({"concepts": [keyword]})
        
        if sort != 'none':
            sort_property, sort_order = sort.split(':')
            builder = builder.with_sort([{
                'path': [sort_property],
                'order': sort_order
            }])
        do = builder.with_additional("id").with_offset(offset).with_limit(limit).do()
        count = client.query.aggregate(class_name).with_meta_count().do().get('data').get('Aggregate').get(class_name)[0].get('meta').get('count')
        
        logger.info(f"Total count: {count}")
        return {
            'data': do.get('data').get('Get').get(class_name),
            'count': count
        }
    except Exception as e:
        logger.error(f"Query error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 新增对象
@app.post("/class/{class_name}/create")
def create_object(class_name: str, obj: ObjectCreate) -> ObjectResponse:
    try:
        # 生成唯一 ID
        object_id = str(uuid.uuid4())
        
        # 准备数据对象
        data_object = obj.properties
        # 确保 total_count 是整数类型
        if 'total_count' in data_object and isinstance(data_object['total_count'], str):
            try:
                data_object['total_count'] = int(data_object['total_count'])
            except ValueError:
                logger.warning(f"Could not convert total_count '{data_object['total_count']}' to int. Keeping as is.")
        
        # 创建对象
        if obj.vector:
            # 如果提供了向量，使用指定向量
            client.data_object.create(
                data_object=data_object,
                class_name=class_name,
                uuid=object_id,
                vector=obj.vector
            )
        else:
            # 如果没有提供向量，让 Weaviate 自动生成
            client.data_object.create(
                data_object=data_object,
                class_name=class_name,
                uuid=object_id
            )
        
        logger.info(f"Created object {object_id} in class {class_name}")
        return ObjectResponse(
            success=True,
            message=f"Successfully created object in {class_name}",
            data={"id": object_id, "properties": data_object}
        )
    except Exception as e:
        logger.error(f"Create error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 更新对象
@app.put("/class/{class_name}/update/{object_id}")
def update_object(class_name: str, object_id: str, obj: ObjectUpdate) -> ObjectResponse:
    try:
        # 检查对象是否存在
        existing = client.data_object.get_by_id(object_id, class_name=class_name)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Object {object_id} not found in class {class_name}")
        
        # 确保 total_count 是整数类型
        if 'total_count' in obj.properties and isinstance(obj.properties['total_count'], str):
            try:
                obj.properties['total_count'] = int(obj.properties['total_count'])
            except ValueError:
                logger.warning(f"Could not convert total_count '{obj.properties['total_count']}' to int. Keeping as is.")

        # 更新对象
        if obj.vector:
            # 如果提供了向量，同时更新属性和向量
            client.data_object.replace(
                data_object=obj.properties,
                class_name=class_name,
                uuid=object_id,
                vector=obj.vector
            )
        else:
            # 只更新属性
            client.data_object.replace(
                data_object=obj.properties,
                class_name=class_name,
                uuid=object_id
            )
        
        logger.info(f"Updated object {object_id} in class {class_name}")
        return ObjectResponse(
            success=True,
            message=f"Successfully updated object {object_id} in {class_name}",
            data={"id": object_id, "properties": obj.properties}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 部分更新对象（PATCH）
@app.patch("/class/{class_name}/patch/{object_id}")
def patch_object(class_name: str, object_id: str, properties: Dict[str, Any]) -> ObjectResponse:
    try:
        # 检查对象是否存在
        existing = client.data_object.get_by_id(object_id, class_name=class_name)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Object {object_id} not found in class {class_name}")
        
        # 合并现有属性和新属性
        existing_props = existing.get('properties', {})
        existing_props.update(properties)

        # 确保 total_count 是整数类型
        if 'total_count' in existing_props and isinstance(existing_props['total_count'], str):
            try:
                existing_props['total_count'] = int(existing_props['total_count'])
            except ValueError:
                logger.warning(f"Could not convert total_count '{existing_props['total_count']}' to int. Keeping as is.")
        
        # 更新对象
        client.data_object.replace(
            data_object=existing_props,
            class_name=class_name,
            uuid=object_id
        )
        
        logger.info(f"Patched object {object_id} in class {class_name}")
        return ObjectResponse(
            success=True,
            message=f"Successfully patched object {object_id} in {class_name}",
            data={"id": object_id, "properties": existing_props}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Patch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 删除对象
@app.delete("/class/{class_name}/delete/{object_id}")
def delete_object(class_name: str, object_id: str) -> ObjectResponse:
    try:
        # 检查对象是否存在
        existing = client.data_object.get_by_id(object_id, class_name=class_name)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Object {object_id} not found in class {class_name}")
        
        # 删除对象
        client.data_object.delete(object_id, class_name=class_name)
        
        logger.info(f"Deleted object {object_id} from class {class_name}")
        return ObjectResponse(
            success=True,
            message=f"Successfully deleted object {object_id} from {class_name}",
            data={"id": object_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 批量删除对象
@app.delete("/class/{class_name}/batch-delete")
def batch_delete_objects(class_name: str, object_ids: List[str]) -> ObjectResponse:
    try:
        deleted_ids = []
        failed_ids = []
        
        with client.batch as batch:
            for object_id in object_ids:
                try:
                    # 检查对象是否存在
                    existing = client.data_object.get_by_id(object_id, class_name=class_name)
                    if existing:
                        batch.delete_object(object_id, class_name=class_name)
                        deleted_ids.append(object_id)
                    else:
                        failed_ids.append({"id": object_id, "reason": "Object not found"})
                except Exception as e:
                    failed_ids.append({"id": object_id, "reason": str(e)})
        
        logger.info(f"Batch deleted {len(deleted_ids)} objects from class {class_name}")
        return ObjectResponse(
            success=True,
            message=f"Batch deletion completed. Deleted: {len(deleted_ids)}, Failed: {len(failed_ids)}",
            data={"deleted": deleted_ids, "failed": failed_ids}
        )
    except Exception as e:
        logger.error(f"Batch delete error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 获取单个对象
@app.get("/class/{class_name}/object/{object_id}")
def get_object(class_name: str, object_id: str):
    try:
        obj = client.data_object.get_by_id(object_id, class_name=class_name)
        if not obj:
            raise HTTPException(status_code=404, detail=f"Object {object_id} not found in class {class_name}")
        
        return {
            "success": True,
            "data": obj
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get object error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 批量创建对象
@app.post("/class/{class_name}/batch-create")
def batch_create_objects(class_name: str, objects: List[ObjectCreate]) -> ObjectResponse:
    try:
        created_ids = []
        failed_objects = []
        
        with client.batch as batch:
            batch.batch_size = 100  # 设置批次大小
            
            for obj in objects:
                try:
                    object_id = str(uuid.uuid4())
                    
                    if obj.vector:
                        batch.add_data_object(
                            data_object=obj.properties,
                            class_name=class_name,
                            uuid=object_id,
                            vector=obj.vector
                        )
                    else:
                        batch.add_data_object(
                            data_object=obj.properties,
                            class_name=class_name,
                            uuid=object_id
                        )
                    
                    created_ids.append(object_id)
                except Exception as e:
                    failed_objects.append({"properties": obj.properties, "reason": str(e)})
        
        logger.info(f"Batch created {len(created_ids)} objects in class {class_name}")
        return ObjectResponse(
            success=True,
            message=f"Batch creation completed. Created: {len(created_ids)}, Failed: {len(failed_objects)}",
            data={"created": created_ids, "failed": failed_objects}
        )
    except Exception as e:
        logger.error(f"Batch create error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 健康检查
@app.get("/health")
def health_check():
    try:
        # 测试 Weaviate 连接
        client.schema.get()
        return {"status": "healthy", "weaviate": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}

app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")