import { useEffect, useState } from 'react';
import * as React from 'react';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import slugify from 'slugify';
import _ from 'lodash';
import { Product } from '../../models/product';
import { FormInput } from '../form/form-input';
import { FormSwitch } from '../form/form-switch';
import { FormSelect } from '../form/form-select';
import { FormChecklist } from '../form/form-checklist';
import { FormRichText } from '../form/form-rich-text';
import { FabButton } from '../base/fab-button';
import ProductCategoryAPI from '../../api/product-category';
import MachineAPI from '../../api/machine';
import ProductAPI from '../../api/product';
import { ProductStockForm } from './product-stock-form';
import { CloneProductModal } from './clone-product-modal';
import ProductLib from '../../lib/product';
import { UnsavedFormAlert } from '../form/unsaved-form-alert';
import { UIRouter } from '@uirouter/angularjs';
import { SelectOption, ChecklistOption } from '../../models/select';
import { FormMultiFileUpload } from '../form/form-multi-file-upload';
import { FormMultiImageUpload } from '../form/form-multi-image-upload';
import { AdvancedAccountingForm } from '../accounting/advanced-accounting-form';
import { FabTabs } from '../base/fab-tabs';
import { HtmlTranslate } from '../base/html-translate';

interface ProductFormProps {
  product: Product,
  title: string,
  onSuccess: (product: Product) => void,
  onError: (message: string) => void,
  uiRouter: UIRouter
}

/**
 * Form component to create or update a product
 */
export const ProductForm: React.FC<ProductFormProps> = ({ product, title, onSuccess, onError, uiRouter }) => {
  const { t } = useTranslation('admin');

  const { handleSubmit, register, control, formState, setValue, reset } = useForm<Product>({ defaultValues: {
    ...product,
    // Commit
    amount: 0,
    quantity_min:1
  } 
  });

  const output = useWatch<Product>({ control });
  const [isActivePrice, setIsActivePrice] = useState<boolean>(product.id && _.isFinite(product.amount));
  const [productCategories, setProductCategories] = useState<SelectOption<number, string | JSX.Element>[]>([]);
  const [machines, setMachines] = useState<ChecklistOption<number>[]>([]);
  const [openCloneModal, setOpenCloneModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    // Commit, ensures amount and quantity_min are always 0 and 1, respectively
    setValue('amount', 0);
    setValue('quantity_min', 1);

    ProductCategoryAPI.index().then(data => {
      setProductCategories(buildSelectOptions(ProductLib.sortCategories(data)));
    }).catch(onError);
    MachineAPI.index({ disabled: false }).then(data => {
      setMachines(buildChecklistOptions(data));
    }).catch(onError);
  }, []);

  /**
   * Convert the provided array of items to the react-select format
   */
  const buildSelectOptions = (items: Array<{ id?: number, name: string, parent_id?: number }>): Array<SelectOption<number, string | JSX.Element>> => {
    return items.map(t => {
      return {
        value: t.id,
        label: t.parent_id
          ? <span className='u-leading-space'>{t.name}</span>
          : t.name
      };
    });
  };

  /**
   * Convert the provided array of items to the checklist format
   */
  const buildChecklistOptions = (items: Array<{ id?: number, name: string }>): Array<ChecklistOption<number>> => {
    return items.map(t => {
      return { value: t.id, label: t.name };
    });
  };

  /**
   * Callback triggered when the name has changed.
   */
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const name = event.target.value;
    const slug = slugify(name, { lower: true, strict: true });
    setValue('slug', slug);
  };

  /**
   * Callback triggered when the user toggles the visibility of the product in the store.
   */

  /**
   * Callback triggered when the form is submitted: process with the product creation or update.
   */
  const onSubmit: SubmitHandler<Product> = (data: Product) => {
    saveProduct(data);
  };

  /**
   * Call product creation or update api
   */
  const saveProduct = (data: Product) => {
    setSaving(true);
    // Commit
    const updatedData = {
      ...data,
      amount: 0, // Ensure price is always 0
      quantity_min: 1 // Ensure minimum quantity is always 1
    };
    if (product.id) {
      ProductAPI.update(data).then((res) => {
        reset(res);
        setSaving(false);
        onSuccess(res);
      }).catch(e => {
        setSaving(false);
        onError(e);
      });
    } else {
      ProductAPI.create(data).then((res) => {
        reset(res);
        onSuccess(res);
      }).catch(e => {
        setSaving(false);
        onError(e);
      });
    }
  };

  /**
   * Toggle clone product modal
   */
  const toggleCloneModal = () => {
    setOpenCloneModal(!openCloneModal);
  };

  /**
   * This function render the content of the 'products settings' tab
   */
  const renderSettingsTab = () => (
    <div className='product-form-content'>
      <section>
        <header>
          <p className="title">{t('app.admin.store.product_form.description')}</p>
          <p className="description">{t('app.admin.store.product_form.description_info')}</p>
        </header>
        <div className="content">
          <FormInput id="name"
                    register={register}
                    rules={{ required: true }}
                    formState={formState}
                    onChange={handleNameChange}
                    label={t('app.admin.store.product_form.name')}
                    className="span-7" />
          <FormInput id="slug"
                   register={register}
                   rules={{ required: true }}
                   formState={formState}
                   label={t('app.admin.store.product_form.slug')}
                   className='span-7' />
          <FormInput id="sku"
                    register={register}
                    formState={formState}
                    label={t('app.admin.store.product_form.sku')}
                    className="span-3" />
          <FormRichText control={control}
                      heading
                      bulletList
                      blockquote
                      link
                      limit={6000}
                      id="description"
                      ariaLabel={t('app.admin.store.product_form.description')} />
        </div>
      </section>

      <section>
        <header>
          <p className="title">{t('app.admin.store.product_form.product_images')}</p>
          <HtmlTranslate className="description" trKey="app.admin.store.product_form.product_images_info" />
        </header>
        <div className="content">
          <FormMultiImageUpload setValue={setValue}
                                addButtonLabel={t('app.admin.store.product_form.add_product_image')}
                                register={register}
                                control={control}
                                id="product_images_attributes" />
        </div>
      </section>


      <section>
        <header>
          <p className="title">{t('app.admin.store.product_form.assigning_category')}</p>
          <HtmlTranslate className="description" trKey="app.admin.store.product_form.assigning_category_info" />
        </header>
        <div className="content">
          <FormSelect options={productCategories}
                      control={control}
                      id="product_category_id"
                      formState={formState}
                      label={t('app.admin.store.product_form.linking_product_to_category')} />
        </div>
      </section>

      <section>
        <header>
          <p className="title" role="heading">{t('app.admin.store.product_form.assigning_machines')}</p>
          <HtmlTranslate className="description" trKey="app.admin.store.product_form.assigning_machines_info" />
        </header>
        <div className="content">
          <FormChecklist options={machines}
                        control={control}
                        id="machine_ids"
                        formState={formState} />
        </div>
      </section>

      <section>
        <header>
          <p className="title">{t('app.admin.store.product_form.product_files')}</p>
          <HtmlTranslate className="description" trKey="app.admin.store.product_form.product_files_info" />
        </header>
        <div className="content">
          <FormMultiFileUpload setValue={setValue}
                              addButtonLabel={t('app.admin.store.product_form.add_product_file')}
                              control={control}
                              accept="application/pdf"
                              register={register}
                              id="product_files_attributes"
                              className="product-documents" />
        </div>
      </section>

      <section>
        <AdvancedAccountingForm register={register} onError={onError} />
      </section>
    </div>
  );

  return (
    <>
      <header>
        <h2>{title}</h2>
        <div className="grpBtn">
          {product.id &&
            <>
              <FabButton onClick={toggleCloneModal}>{t('app.admin.store.product_form.clone')}</FabButton>
              <CloneProductModal isOpen={openCloneModal} toggleModal={toggleCloneModal} product={product} onSuccess={onSuccess} onError={onError} />
            </>
          }
          <FabButton className="main-action-btn" onClick={handleSubmit(saveProduct)} disabled={saving}>
            {!saving && t('app.admin.store.product_form.save')}
            {saving && <i className="fa fa-spinner fa-pulse fa-fw text-white" />}
          </FabButton>
        </div>
      </header>
      <form className="product-form" onSubmit={handleSubmit(onSubmit)}>
        <UnsavedFormAlert uiRouter={uiRouter} formState={formState} />
        <FabTabs tabs={[
          {
            id: 'settings',
            title: t('app.admin.store.product_form.product_parameters'),
            content: renderSettingsTab()
          },
          {
            id: 'stock',
            title: t('app.admin.store.product_form.stock_management'),
            content: <ProductStockForm currentFormValues={output as Product}
                                       register={register}
                                       control={control}
                                       formState={formState}
                                       setValue={setValue}
                                       onError={onError}
                                       onSuccess={onSuccess} />
          }
        ]} />
      </form>
    </>
  );
};
