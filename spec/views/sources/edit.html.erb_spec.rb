require 'rails_helper'

RSpec.describe "sources/edit", type: :view do
  before(:each) do
    @source = assign(:source, Source.create!(
      :description => "MyString",
      :link => "MyString"
    ))
  end

  it "renders the edit source form" do
    render

    assert_select "form[action=?][method=?]", source_path(@source), "post" do

      assert_select "input#source_description[name=?]", "source[description]"

      assert_select "input#source_link[name=?]", "source[link]"
    end
  end
end
