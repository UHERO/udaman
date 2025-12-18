require 'rails_helper'

RSpec.describe "exports/edit", type: :view do
  before(:each) do
    @export = assign(:export, Export.create!(
      :name => "MyString",
      :created_by => 1,
      :updated_by => 1,
      :owned_by => 1
    ))
  end

  it "renders the edit export form" do
    render

    assert_select "form[action=?][method=?]", export_path(@export), "post" do

      assert_select "input#export_name[name=?]", "export[name]"

    end
  end
end
