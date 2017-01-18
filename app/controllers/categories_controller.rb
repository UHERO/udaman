class CategoriesController < ApplicationController
  include Authorization
  
  before_action :check_authorization
  before_action :set_category, only: [:show, :edit, :update, :destroy, :up, :down]

  # GET /categories
  def index
    @category_roots = Category.roots.to_a
  end

  # GET /categories/1
  def show
  end

  # GET /categories/new
  def new
    @category = Category.new
  end

  # GET /categories/1/edit
  def edit
  end

  # POST /categories
  def create
    @category = Category.new(category_params)

    if @category.store_cat
      redirect_to @category, notice: 'Category was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /categories/1
  def update
    if @category.update(category_params)
      redirect_to @category, notice: 'Category was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /categories/1
  def destroy
    @category.destroy
    redirect_to categories_url, notice: 'Category was successfully destroyed.'
  end

  def up
    siblings_array = @category.siblings.to_a.sort_by{|sib| sib.order}
    old_index = siblings_array.index(@category)
    siblings_array.each_index do |i|
      if old_index - 1 == i
        siblings_array[i].update order: i + 1
        next
      end
      if old_index == i
        siblings_array[i].update order: i - 1
        next
      end
      siblings_array[i].update order: i
    end
    redirect_to categories_url
  end

  def down
    siblings_array = @category.siblings.to_a.sort_by{|sib| sib.order}
    old_index = siblings_array.index(@category)
    siblings_array.each_index do |i|
      if old_index + 1 == i
        siblings_array[i].update order: i - 1
        next
      end
      if old_index == i
        siblings_array[i].update order: i + 1
        next
      end
      siblings_array[i].update order: i
    end
    redirect_to categories_url
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_category
      @category = Category.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def category_params
      params.require(:category).permit(:name, :parent_id, :data_list_id, :default_handle, :default_freq)
    end
end
