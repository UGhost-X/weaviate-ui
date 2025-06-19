import React, {useEffect, useRef, useState} from "react";
import {getClass, createObject, updateObject, deleteObject, batchDeleteObjects} from "./api.ts";
import {ActionType, ProTable, ModalForm, ProFormText, ProFormTextArea} from "@ant-design/pro-components";
import {Button, message, Popconfirm, Modal, Form, Input, Space} from "antd";
import {PlusOutlined, EditOutlined, DeleteOutlined} from "@ant-design/icons";

export default function ({pathname, propties}: any) {
    let propertyNames = propties.map(x => x.name);
    const [keyword, setKeyword] = useState("none")
    const [clzData, setClzData] = useState([])
    const [total, setTotal] = useState(0)
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();

    const className = pathname.replace('/class/', '');

    useEffect(() => {
        getClass(className, 0, 20, keyword, propertyNames).then(({data, count}) => {
            setClzData(data)
            setTotal(count)
        })
    }, [pathname, keyword])

    // 构建列配置
    let columns = [];
    columns.push({
        title: 'Id',
        dataIndex: 'index',
        width: 200,
        ellipsis: true,
        sorter: true,
    });

    propties.forEach((proptie: any) => {
        columns.push({
            title: proptie.name,
            dataIndex: proptie.name,
            ellipsis: true,
            sorter: true,
        })
    });

    // 添加操作列
    columns.push({
        title: '操作',
        valueType: 'option',
        width: 150,
        render: (text, record, _, action) => [
            <Button
                key="edit"
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
            >
                编辑
            </Button>,
            <Popconfirm
                key="delete"
                title="确定要删除这个对象吗？"
                onConfirm={() => handleDelete(record.index)}
                okText="确定"
                cancelText="取消"
            >
                <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                >
                    删除
                </Button>
            </Popconfirm>,
        ],
    });

    // 处理创建
    const handleCreate = async (values: any) => {
        try {
            // 确保 total_count 属性是整数类型
            if (values.total_count) {
                values.total_count = parseInt(values.total_count, 10);
            }
            const result = await createObject(className, values);
            if (result.success) {
                message.success('创建成功');
                setCreateModalVisible(false);
                form.resetFields();
                ref.current?.reload();
            } else {
                message.error(result.message || '创建失败');
            }
        } catch (error) {
            message.error('创建失败');
            console.error('Create error:', error);
        }
    };

    // 处理编辑
    const handleEdit = (record: any) => {
        setEditingRecord(record);
        const formData = {};
        propertyNames.forEach(prop => {
            formData[prop] = record[prop];
        });
        editForm.setFieldsValue(formData);
        setEditModalVisible(true);
    };

    // 处理更新
    const handleUpdate = async (values: any) => {
        try {
            // 确保 total_count 属性是整数类型
            if (values.total_count) {
                values.total_count = parseInt(values.total_count, 10);
            }
            const result = await updateObject(className, editingRecord.index, values);
            if (result.success) {
                message.success('更新成功');
                setEditModalVisible(false);
                editForm.resetFields();
                setEditingRecord(null);
                ref.current?.reload();
            } else {
                message.error(result.message || '更新失败');
            }
        } catch (error) {
            message.error('更新失败');
            console.error('Update error:', error);
        }
    };

    // 处理删除
    const handleDelete = async (objectId: string) => {
        try {
            const result = await deleteObject(className, objectId);
            if (result.success) {
                message.success('删除成功');
                ref.current?.reload();
            } else {
                message.error(result.message || '删除失败');
            }
        } catch (error) {
            message.error('删除失败');
            console.error('Delete error:', error);
        }
    };

    // 处理批量删除
    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请选择要删除的项目');
            return;
        }

        try {
            const result = await batchDeleteObjects(className, selectedRowKeys);
            if (result.success) {
                message.success(`批量删除成功，删除了 ${result.data.deleted.length} 个对象`);
                setSelectedRowKeys([]);
                ref.current?.reload();
            } else {
                message.error(result.message || '批量删除失败');
            }
        } catch (error) {
            message.error('批量删除失败');
            console.error('Batch delete error:', error);
        }
    };

    // 生成表单项
    const generateFormItems = (formInstance: any) => {
        return propties.map((property: any) => (
            <Form.Item
                key={property.name}
                label={property.name}
                name={property.name}
                rules={[
                    {
                        required: property.dataType?.includes('!'),
                        message: `请输入${property.name}`,
                    },
                ]}
            >
                {property.dataType?.includes('text') ? (
                    <Input.TextArea rows={3} placeholder={`请输入${property.name}`} />
                ) : property.dataType?.includes('int') || property.dataType?.includes('number') ? (
                    <Input type="number" placeholder={`请输入${property.name}`} />
                ) : (
                    <Input placeholder={`请输入${property.name}`} />
                )}
            </Form.Item>
        ));
    };

    const ref = useRef<ActionType>();

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => {
            setSelectedRowKeys(keys as string[]);
        },
    };

    return (
        <div>
            <ProTable
                actionRef={ref}
                params={{pathname: pathname}}
                columns={columns}
                request={async (params: any, sorter: any) => {
                    let sort = "none";
                    if (Object.keys(sorter).length > 0) {
                        const sortKey = Object.keys(sorter)[0];
                        const sortOrder = sorter[sortKey] === 'ascend' ? 'asc' : 'desc';
                        sort = `${sortKey}:${sortOrder}`;
                    }
                    let clzData = await getClass(className, (params.current - 1) * params.pageSize, params.pageSize, keyword, propertyNames, sort);
                    let data = clzData.data.map((clz: any) => {
                        let res = {};
                        propertyNames.forEach((proptie: any) => {
                            res[proptie] = clz[proptie];
                        });
                        res['index'] = clz['_additional']['id'];
                        res['key'] = clz['_additional']['id'];
                        return res;
                    });
                    return {
                        data: data,
                        success: true,
                        total: clzData.count,
                    };
                }}
                rowKey="key"
                rowSelection={rowSelection}
                dateFormatter="string"
                toolbar={{
                    title: `Class: ${className}`,
                    tooltip: '',
                    search: {
                        onSearch: async (value: string) => {
                            setKeyword(value || "none")
                            ref.current?.reload()
                        },
                    },
                }}
                search={false}
                toolBarRender={() => [
                    <Button
                        key="create"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreateModalVisible(true)}
                    >
                        新建
                    </Button>,
                    selectedRowKeys.length > 0 && (
                        <Popconfirm
                            key="batchDelete"
                            title={`确定要删除选中的 ${selectedRowKeys.length} 个对象吗？`}
                            onConfirm={handleBatchDelete}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                批量删除 ({selectedRowKeys.length})
                            </Button>
                        </Popconfirm>
                    ),
                ]}
            />

            {/* 创建对象模态框 */}
            <Modal
                title={`新建 ${className} 对象`}
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false);
                    form.resetFields();
                }}
                onOk={() => form.submit()}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreate}
                >
                    {generateFormItems(form)}
                </Form>
            </Modal>

            {/* 编辑对象模态框 */}
            <Modal
                title={`编辑 ${className} 对象`}
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false);
                    editForm.resetFields();
                    setEditingRecord(null);
                }}
                onOk={() => editForm.submit()}
                width={600}
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleUpdate}
                >
                    {generateFormItems(editForm)}
                </Form>
            </Modal>
        </div>
    );
}