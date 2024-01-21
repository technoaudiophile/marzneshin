import {
    Alert,
    AlertIcon,
    Box,
    Collapse,
    Flex,
    FormControl,
    FormErrorMessage,
    FormHelperText,
    FormLabel,
    Grid,
    GridItem,
    HStack,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    Modal,
    Select,
    Switch,
    Textarea,
    Tooltip,
    VStack,
    useColorMode,
    useToast,
    Spinner,
    ModalOverlay,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetStrategy } from "constants/UserSettings";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { FC, useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import ReactDatePicker from "react-datepicker";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
    User,
    UserCreate,
} from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { Input } from "../Input";
import { ServicesSelectList } from "../ServicesSelectList";
import { UsageFilter, createUsageConfig } from "../UsageFilter";
import { AddUserIcon, EditUserIcon } from "./UserDialogIcons";
import { DevTool } from "@hookform/devtools";
import { UserDialogModalHeader } from "./ModalHeader";
import { UserDialogModalFooter } from "./ModalFooter";
import { getDefaultValues } from "./DefaultValues";
import { schema, FormType } from "./FormSchema";


const formatUser = (user: User): FormType => {
    return {
        ...user,
        data_limit: user.data_limit
            ? Number((user.data_limit / 1073741824).toFixed(5))
            : user.data_limit,
    };
};


export type UserDialogProps = {};

export const UserDialog: FC<UserDialogProps> = () => {
    const {
        editingUser,
        isCreatingNewUser,
        services,
        onCreateUser,
        editUser,
        fetchUserUsage,
        refetchServices,
        onEditingUser,
        createUser,
        onDeletingUser,
    } = useDashboard();
    const isEditing = !!editingUser;
    const isOpen = isCreatingNewUser || isEditing;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>("");
    const toast = useToast();
    const { t, i18n } = useTranslation();

    const { colorMode } = useColorMode();

    const [usageVisible, setUsageVisible] = useState(false);
    const handleUsageToggle = () => {
        setUsageVisible((current) => !current);
    };

    const form = useForm<FormType>({
        defaultValues: getDefaultValues(),
        resolver: zodResolver(schema),
    });

    const [dataLimit] = useWatch({
        control: form.control,
        name: ["data_limit"],
    });

    const usageTitle = t("userDialog.total");
    const [usage, setUsage] = useState(createUsageConfig(colorMode, usageTitle));
    const [usageFilter, setUsageFilter] = useState("1m");
    const fetchUsageWithFilter = (query: FilterUsageType) => {
        fetchUserUsage(editingUser!, query).then((data: any) => {
            const labels = [];
            const series = [];
            for (const key in data.usages) {
                series.push(data.usages[key].used_traffic);
                labels.push(data.usages[key].node_name);
            }
            setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
        });
    };

    useEffect(() => {
        if (isOpen) {
            refetchServices();
        }
    }, [isOpen]);


    useEffect(() => {
        if (editingUser) {
            form.reset(formatUser(editingUser));

            fetchUsageWithFilter({
                start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
            });
        }
    }, [editingUser]);

    const submit = async (values: FormType) => {
        setLoading(true);
        const methods = { edited: editUser, created: createUser };
        const method = isEditing ? "edited" : "created";
        setError(null);
        console.log('Form errors:', form.formState.errors);

        console.log("For Value", values);
        const { services, username, ...rest } = values;

        let body: UserCreate = {
            ...rest,
            username,
            services,
            data_limit: values.data_limit,
            data_limit_reset_strategy:
                values.data_limit && values.data_limit > 0
                    ? values.data_limit_reset_strategy
                    : "no_reset",
            status:
                values.status === "active" || values.status === "disabled"
                    ? values.status
                    : "active",
        };

        await methods[method](body)
            .then(() => {
                toast({
                    title: t(
                        isEditing ? "userDialog.userEdited" : "userDialog.userCreated",
                        { username: values.username }
                    ),
                    status: "success",
                    isClosable: true,
                    position: "top",
                    duration: 3000,
                });
                onClose();
            })
            .catch((err) => {
                if (err?.response?.status === 409 || err?.response?.status === 400)
                    setError(err?.response?._data?.detail);
                if (err?.response?.status === 422) {
                    Object.keys(err.response._data.detail).forEach((key) => {
                        setError(err?.response._data.detail[key] as string);
                        form.setError(
                            key as "services" | "username" | "data_limit" | "expire",
                            {
                                type: "custom",
                                message: err.response._data.detail[key],
                            }
                        );
                    });
                }
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const onClose = () => {
        form.reset(getDefaultValues());
        onCreateUser(false);
        onEditingUser(null);
        setError(null);
        setUsageVisible(false);
        setUsageFilter("1m");
    };

    const handleResetUsage = () => {
        useDashboard.setState({ resetUsageUser: editingUser });
    };

    const handleRevokeSubscription = () => {
        useDashboard.setState({ revokeSubscriptionUser: editingUser });
    };

    const disabled = loading;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
            <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
            <FormProvider {...form} formState={form.formState}>
                <ModalContent mx="3">
                    <form onSubmit={form.handleSubmit(submit)}>
                        <UserDialogModalHeader HeaderIcon={isEditing ? EditUserIcon : AddUserIcon} title={isEditing ? t("userDialog.editUserTitle") : t("createNewUser")} />
                        <ModalCloseButton mt={3} disabled={disabled} />
                        <ModalBody>
                            <Grid
                                templateColumns={{
                                    base: "repeat(1, 1fr)",
                                    md: "repeat(2, 1fr)",
                                }}
                                gap={3}
                            >
                                <GridItem>
                                    <VStack justifyContent="space-between">
                                        <Flex
                                            flexDirection="column"
                                            gridAutoRows="min-content"
                                            w="full"
                                        >
                                            <FormControl mb={"10px"}>
                                                <FormLabel>{t("username")}</FormLabel>
                                                <HStack>
                                                    <Input
                                                        size="sm"
                                                        type="text"
                                                        borderRadius="6px"
                                                        error={form.formState.errors.username?.message}
                                                        disabled={disabled || isEditing}
                                                        {...form.register("username")}
                                                    />
                                                    {isEditing && (
                                                        <HStack px={1}>
                                                            <Controller
                                                                name="status"
                                                                control={form.control}
                                                                render={({ field }) => {
                                                                    return (
                                                                        <Tooltip
                                                                            placement="top"
                                                                            label={"status: " + field.value}
                                                                            textTransform="capitalize"
                                                                        >
                                                                            <Box>
                                                                                <Switch
                                                                                    colorScheme="primary"
                                                                                    disabled={
                                                                                        field.value !== "active" &&
                                                                                        field.value !== "disabled"
                                                                                    }
                                                                                    isChecked={field.value === "active"}
                                                                                    onChange={(e) => {
                                                                                        if (e.target.checked) {
                                                                                            field.onChange("active");
                                                                                        } else {
                                                                                            field.onChange("disabled");
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </Box>
                                                                        </Tooltip>
                                                                    );
                                                                }}
                                                            />
                                                        </HStack>
                                                    )}
                                                </HStack>
                                            </FormControl>
                                            <FormControl mb={"10px"}>
                                                <FormLabel>{t("userDialog.dataLimit")}</FormLabel>
                                                <Controller
                                                    control={form.control}
                                                    name="data_limit"
                                                    render={({ field }) => {
                                                        return (
                                                            <Input
                                                                endAdornment="GB"
                                                                type="number"
                                                                size="sm"
                                                                borderRadius="6px"
                                                                onChange={field.onChange}
                                                                disabled={disabled}
                                                                error={
                                                                    form.formState.errors.data_limit?.message
                                                                }
                                                                value={field.value ? String(field.value) : ""}
                                                            />
                                                        );
                                                    }}
                                                />
                                            </FormControl>
                                            <Collapse
                                                in={!!(dataLimit && dataLimit > 0)}
                                                animateOpacity
                                                style={{ width: "100%" }}
                                            >
                                                <FormControl height="66px">
                                                    <FormLabel>
                                                        {t("userDialog.periodicUsageReset")}
                                                    </FormLabel>
                                                    <Controller
                                                        control={form.control}
                                                        name="data_limit_reset_strategy"
                                                        render={({ field }) => {
                                                            return (
                                                                <Select size="sm" {...field}>
                                                                    {resetStrategy.map((s) => {
                                                                        return (
                                                                            <option key={s.value} value={s.value}>
                                                                                {t(
                                                                                    "userDialog.resetStrategy" + s.title
                                                                                )}
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </Select>
                                                            );
                                                        }}
                                                    />
                                                </FormControl>
                                            </Collapse>
                                            <FormControl mb={"10px"}>
                                                <FormLabel>{t("userDialog.expiryDate")}</FormLabel>
                                                <Controller
                                                    name="expire"
                                                    control={form.control}
                                                    render={({ field }) => {
                                                        function createDateAsUTC(num: number) {
                                                            return dayjs(
                                                                dayjs(num * 1000).utc()
                                                                // .format("MMMM D, YYYY") // exception with: dayjs.locale(lng);
                                                            ).toDate();
                                                        }
                                                        const { status, time } = relativeExpiryDate(
                                                            field.value
                                                        );
                                                        return (
                                                            <>
                                                                <ReactDatePicker
                                                                    locale={i18n.language.toLocaleLowerCase()}
                                                                    dateFormat={t("dateFormat")}
                                                                    minDate={new Date()}
                                                                    selected={
                                                                        field.value
                                                                            ? createDateAsUTC(field.value)
                                                                            : undefined
                                                                    }
                                                                    onChange={(date: Date) => {
                                                                        field.onChange({
                                                                            target: {
                                                                                value: date
                                                                                    ? dayjs(
                                                                                        dayjs(date)
                                                                                            .set("hour", 23)
                                                                                            .set("minute", 59)
                                                                                            .set("second", 59)
                                                                                    )
                                                                                        .utc()
                                                                                        .valueOf() / 1000
                                                                                    : 0,
                                                                                name: "expire",
                                                                            },
                                                                        });
                                                                    }}
                                                                    customInput={
                                                                        <Input
                                                                            size="sm"
                                                                            type="text"
                                                                            borderRadius="6px"
                                                                            clearable
                                                                            disabled={disabled}
                                                                            error={
                                                                                form.formState.errors.expire?.message
                                                                            }
                                                                        />
                                                                    }
                                                                />
                                                                {field.value ? (
                                                                    <FormHelperText>
                                                                        {t(status, { time: time })}
                                                                    </FormHelperText>
                                                                ) : (
                                                                    ""
                                                                )}
                                                            </>
                                                        );
                                                    }}
                                                />
                                            </FormControl>

                                            <FormControl
                                                mb={"10px"}
                                                isInvalid={!!form.formState.errors.note}
                                            >
                                                <FormLabel>{t("userDialog.note")}</FormLabel>
                                                <Textarea {...form.register("note")} />
                                                <FormErrorMessage>
                                                    {form.formState.errors?.note?.message}
                                                </FormErrorMessage>
                                            </FormControl>
                                        </Flex>
                                        {error && (
                                            <Alert
                                                status="error"
                                                display={{ base: "none", md: "flex" }}
                                            >
                                                <AlertIcon />
                                                {error}
                                            </Alert>
                                        )}
                                    </VStack>
                                </GridItem>

                                <GridItem>
                                    {services.length === 0 ? (
                                        <Spinner />
                                    ) :
                                        <FormControl
                                            isInvalid={
                                                !!form.formState.errors.services?.message
                                            }
                                        >
                                            <FormLabel>{t("userDialog.services")}</FormLabel>
                                            <Controller
                                                control={form.control}
                                                name="services"
                                                render={({ field }) => {
                                                    return (
                                                        <ServicesSelectList
                                                            list={services}
                                                            disabled={disabled}
                                                            {...field}
                                                        />
                                                    );
                                                }}
                                            />
                                            <FormErrorMessage>
                                                {t(
                                                    form.formState.errors.services
                                                        ?.message as string
                                                )}
                                            </FormErrorMessage>
                                        </FormControl>
                                    }
                                </GridItem>

                                {isEditing && usageVisible && (
                                    <GridItem pt={6} colSpan={{ base: 1, md: 2 }}>
                                        <VStack gap={4}>
                                            <UsageFilter
                                                defaultValue={usageFilter}
                                                onChange={(filter, query) => {
                                                    setUsageFilter(filter);
                                                    fetchUsageWithFilter(query);
                                                }}
                                            />
                                            <Box
                                                width={{ base: "100%", md: "70%" }}
                                                justifySelf="center"
                                            >
                                                <ReactApexChart
                                                    options={usage.options}
                                                    series={usage.series}
                                                    type="donut"
                                                />
                                            </Box>
                                        </VStack>
                                    </GridItem>
                                )}
                            </Grid>

                            {error && (
                                <Alert
                                    mt="3"
                                    status="error"
                                    display={{ base: "flex", md: "none" }}
                                >
                                    <AlertIcon />
                                    {error}
                                </Alert>
                            )}
                        </ModalBody>
                        <UserDialogModalFooter
                            editingUser={isEditing ? editingUser : null}
                            onClose={onClose}
                            isEditing={isEditing}
                            onDeletingUser={onDeletingUser}
                            handleUsageToggle={handleUsageToggle}
                            handleResetUsage={handleResetUsage}
                            handleRevokeSubscription={handleRevokeSubscription}
                            loading={loading}
                        />
                    </form>
                </ModalContent>
            </FormProvider>
        </Modal >
    );
};