require 'rails_helper'

RSpec.describe 'categories/index', type: :view do

  before(:each) do
    @data_list = DataList.create!(name: 'MyDL') rescue nil
    assign(:category_roots, [
      Category.create!(
        :name => 'Name',
        :parent_id => nil,
        :data_list_id => @data_list.id
      ),
      Category.create!(
        :name => 'Name',
        :parent_id => nil,
        :data_list_id => @data_list.id
      )
    ])
  end

  it 'renders a list of categories' do
    user = FactoryBot.create(:user)
    view.stub(:current_user).and_return(user)
    controller.stub(:current_user).and_return(user)
    render
    assert_select 'ul>li>span', :text => 'Name'.to_s, :count => 2
  end
end
