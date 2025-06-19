let host = ""
// let host = "http://localhost:7777"

export const getSchema = () => {
    return fetch(host + "/schema")
        .then(response => response.json())
        .catch(error => console.log(error))
}

export const getClass = (className: string, offset: number, limit: number, keyword: string, properties: [any], sort: string = 'none') => {
    const queryString = new URLSearchParams();
    properties.forEach(prop => queryString.append('properties', prop));
    if (sort !== 'none') {
        queryString.append('sort', sort);
    }

    const url = `${host}/class/${className}/${offset}/${limit}/${keyword}${queryString.toString() ? `?${queryString.toString()}` : ''}`;

    return fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }
    )
        .then(response => response.json())
        .catch(error => console.log(error))
}

// 创建单个对象
export const createObject = (className: string, properties: any, vector?: number[]) => {
    const body = {
        properties,
        ...(vector && { vector })
    };
    
    return fetch(`${host}/class/${className}/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Create object error:', error);
            throw error;
        });
}

// 批量创建对象
export const batchCreateObjects = (className: string, objects: Array<{properties: any, vector?: number[]}>) => {
    return fetch(`${host}/class/${className}/batch-create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(objects),
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Batch create objects error:', error);
            throw error;
        });
}

// 获取单个对象
export const getObject = (className: string, objectId: string) => {
    return fetch(`${host}/class/${className}/object/${objectId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Get object error:', error);
            throw error;
        });
}

// 更新对象（完全替换）
export const updateObject = (className: string, objectId: string, properties: any, vector?: number[]) => {
    const body = {
        properties,
        ...(vector && { vector })
    };
    
    return fetch(`${host}/class/${className}/update/${objectId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Update object error:', error);
            throw error;
        });
}

// 部分更新对象
export const patchObject = (className: string, objectId: string, properties: any) => {
    return fetch(`${host}/class/${className}/patch/${objectId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(properties),
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Patch object error:', error);
            throw error;
        });
}

// 删除单个对象
export const deleteObject = (className: string, objectId: string) => {
    return fetch(`${host}/class/${className}/delete/${objectId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Delete object error:', error);
            throw error;
        });
}

// 批量删除对象
export const batchDeleteObjects = (className: string, objectIds: string[]) => {
    return fetch(`${host}/class/${className}/batch-delete`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(objectIds),
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Batch delete objects error:', error);
            throw error;
        });
}

// 健康检查
export const healthCheck = () => {
    return fetch(`${host}/health`)
        .then(response => response.json())
        .catch(error => {
            console.error('Health check error:', error);
            throw error;
        });
}